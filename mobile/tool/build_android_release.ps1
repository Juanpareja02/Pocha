param(
  [ValidateSet('apk', 'aab', 'both')]
  [string]$Artifact = 'both',
  [string]$ProjectId = $(if ($env:FIREBASE_PROJECT_ID) { $env:FIREBASE_PROJECT_ID } else { 'la-pocha-app' }),
  [string]$ServerUrl = $(if ($env:STAGING_API_URL) { $env:STAGING_API_URL } else { $env:POCHA_SERVER_URL }),
  [string]$SocketUrl = $(if ($env:STAGING_SOCKET_URL) { $env:STAGING_SOCKET_URL } else { $env:STAGING_API_URL }),
  [string]$LinkHost = $(if ($env:POCHA_LINK_HOST) { $env:POCHA_LINK_HOST } else { 'example.invalid' }),
  [string]$AppLabel = $(if ($env:POCHA_APP_LABEL) { $env:POCHA_APP_LABEL } else { 'La Pocha Staging' }),
  [switch]$AnalyzeSize
)

$ErrorActionPreference = 'Stop'

# Make the command reproducible from the repository root or from mobile/.
$mobileRoot = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($SocketUrl)) {
  $SocketUrl = $ServerUrl
}

function Assert-PublicHttpsUrl([string]$name, [string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "$name is required and must be a public HTTPS staging/release URL"
  }
  try {
    $parsed = [Uri]$value
  } catch {
    throw "$name must be a valid URL"
  }
  $uriHost = $parsed.Host.ToLowerInvariant()
  $reservedHost =
    $uriHost -eq 'localhost' -or
    @('127.0.0.1', '0.0.0.0', '10.0.2.2', 'example.com', 'example.org', 'example.net', 'invalid') -contains $uriHost -or
    $uriHost.EndsWith('.example.com') -or
    $uriHost.EndsWith('.example.org') -or
    $uriHost.EndsWith('.example.net') -or
    $uriHost.EndsWith('.invalid')
  if ($parsed.Scheme -ne 'https' -or $reservedHost) {
    throw "$name must use a public HTTPS host for release builds"
  }
}

Assert-PublicHttpsUrl 'STAGING_API_URL' $ServerUrl
Assert-PublicHttpsUrl 'STAGING_SOCKET_URL' $SocketUrl

# On Windows PowerShell, the firebase.ps1 shim promotes the CLI's progress
# message to a terminating error under ErrorActionPreference=Stop. Prefer the
# native .cmd shim and keep the generic command as the cross-platform fallback.
$firebase = Get-Command firebase.cmd -ErrorAction SilentlyContinue
if (-not $firebase) {
  $firebase = Get-Command firebase -ErrorAction SilentlyContinue
}
if (-not $firebase) {
  throw 'Firebase CLI is required to resolve the Android app configuration'
}

$cliErrorAction = $ErrorActionPreference
try {
  $ErrorActionPreference = 'Continue'
  $appsText = & $firebase.Source apps:list --project $ProjectId --json 2>$null | Out-String
} finally {
  $ErrorActionPreference = $cliErrorAction
}
$appsJsonStart = $appsText.IndexOf('{')
if ($appsJsonStart -lt 0) {
  throw 'Firebase apps:list did not return JSON'
}
$apps = $appsText.Substring($appsJsonStart) | ConvertFrom-Json
$androidApps = @(
  $apps.result |
    Where-Object { $_.platform -eq 'ANDROID' -and $_.namespace -eq 'com.pocha.mobile' }
)
if ($androidApps.Count -ne 1) {
  throw "Expected exactly one Firebase Android app with package com.pocha.mobile; found $($androidApps.Count)"
}
$androidApp = $androidApps[0]
Write-Output "Resolved Firebase Android app for com.pocha.mobile: $($androidApp.appId)"

try {
  $ErrorActionPreference = 'Continue'
  $sdkText = & $firebase.Source apps:sdkconfig android $androidApp.appId --project $ProjectId 2>$null | Out-String
} finally {
  $ErrorActionPreference = $cliErrorAction
}
$sdkJsonStart = $sdkText.IndexOf('{')
if ($sdkJsonStart -lt 0) {
  throw 'Firebase apps:sdkconfig did not return JSON'
}
$sdk = $sdkText.Substring($sdkJsonStart) | ConvertFrom-Json
$matchingClients = @(
  $sdk.client |
    Where-Object {
      $_.client_info.mobilesdk_app_id -eq $androidApp.appId -and
      $_.client_info.android_client_info.package_name -eq 'com.pocha.mobile'
    }
)
if ($matchingClients.Count -ne 1) {
  throw "Firebase SDK config did not contain exactly one matching com.pocha.mobile client; found $($matchingClients.Count)"
}
$client = $matchingClients[0]
$apiKey = [string]$client.api_key[0].current_key
$firebaseAppId = [string]$client.client_info.mobilesdk_app_id
$messagingSenderId = [string]$sdk.project_info.project_number
$firebaseProjectId = [string]$sdk.project_info.project_id
$googleServerClientId = [string](@(
    $client.oauth_client |
      Where-Object { [int]$_.client_type -eq 3 } |
      Select-Object -First 1
  ).client_id)
if ([string]::IsNullOrWhiteSpace($apiKey) -or
    [string]::IsNullOrWhiteSpace($firebaseAppId) -or
    [string]::IsNullOrWhiteSpace($messagingSenderId) -or
    [string]::IsNullOrWhiteSpace($firebaseProjectId) -or
    [string]::IsNullOrWhiteSpace($googleServerClientId)) {
  throw 'Firebase SDK config is missing required public Android or Google fields'
}

$env:POCHA_LINK_HOST = $LinkHost
$env:POCHA_LINK_AUTO_VERIFY = if ($env:POCHA_LINK_AUTO_VERIFY) { $env:POCHA_LINK_AUTO_VERIFY } else { 'false' }
$env:POCHA_APP_LABEL = $AppLabel
$defines = @(
  "--dart-define=STAGING_API_URL=$ServerUrl",
  "--dart-define=STAGING_SOCKET_URL=$SocketUrl",
  '--dart-define=POCHA_AUTH_MODE=external',
  "--dart-define=POCHA_FIREBASE_API_KEY=$apiKey",
  "--dart-define=POCHA_FIREBASE_APP_ID=$firebaseAppId",
  "--dart-define=POCHA_FIREBASE_MESSAGING_SENDER_ID=$messagingSenderId",
  "--dart-define=POCHA_FIREBASE_PROJECT_ID=$firebaseProjectId",
  "--dart-define=POCHA_GOOGLE_SERVER_CLIENT_ID=$googleServerClientId"
)

function Build-Artifact([string]$kind) {
  $extraArgs = @()
  if ($AnalyzeSize -and $kind -eq 'appbundle') {
    $extraArgs += '--analyze-size'
    $extraArgs += '--target-platform=android-arm64'
  }
  Push-Location -LiteralPath $mobileRoot
  try {
    & flutter build $kind --release @extraArgs @defines
    $flutterExitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  if ($flutterExitCode -ne 0) {
    throw "Flutter $kind release build failed"
  }
}

if ($Artifact -eq 'apk' -or $Artifact -eq 'both') {
  Build-Artifact 'apk'
}
if ($Artifact -eq 'aab' -or $Artifact -eq 'both') {
  Build-Artifact 'appbundle'
}
