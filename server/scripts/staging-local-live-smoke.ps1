$ErrorActionPreference = 'Stop'

function Set-RequiredEnvironment {
  param(
    [string]$Name,
    [string]$Value
  )
  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "$Name is required"
  }
  Set-Item -Path "Env:$Name" -Value $Value
}

function Get-ReadyStatus {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3101/health/ready' -TimeoutSec 3
    return [int]$response.StatusCode
  } catch {
    if ($_.Exception.Response) {
      return [int]$_.Exception.Response.StatusCode
    }
    throw
  }
}

function Assert-RedisFailureAndRecovery {
  $redisPidText = wsl.exe -d PochaStaging -- pgrep -f 'redis-server 0.0.0.0:6380' 2>$null
  $redisPid = if ([string]::IsNullOrWhiteSpace($redisPidText)) {
    ''
  } else {
    $redisPidText.Trim()
  }
  if ($redisPid -notmatch '^\d+$') {
    throw 'isolated Redis process could not be located for failure test'
  }
  wsl.exe -d PochaStaging -- sudo kill $redisPid | Out-Null
  Start-Sleep -Seconds 3
  if ((Get-ReadyStatus) -ne 503) {
    throw 'readiness stayed healthy after Redis became unavailable'
  }

  wsl.exe -d PochaStaging -- sudo redis-server --port 6380 --bind 0.0.0.0 --protected-mode no --dir /tmp --dbfilename pocha-staging-smoke.rdb --save '' --appendonly no --requirepass $redisPassword --daemonize yes | Out-Null
  for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
    Start-Sleep -Seconds 1
    try {
      $redisPing = (wsl.exe -d PochaStaging -- redis-cli -h 127.0.0.1 -p 6380 --no-auth-warning -a $redisPassword ping 2>$null).Trim()
      if ($redisPing -eq 'PONG' -and (Get-ReadyStatus) -eq 200) {
        return
      }
    } catch {
      # Redis may still be reconnecting; the next probe is authoritative.
    }
  }
  throw 'readiness did not recover after isolated Redis restarted'
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$serverRoot = Join-Path $repoRoot 'server'
$wslIp = (wsl.exe -d PochaStaging -- hostname -I).Trim().Split(' ')[0]
if ([string]::IsNullOrWhiteSpace($wslIp)) {
  throw 'PochaStaging WSL IP could not be resolved'
}

$dbPassword = [guid]::NewGuid().ToString('N')
$redisPassword = [guid]::NewGuid().ToString('N')
$redisNamespace = "staging-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
$firebaseCredentials = $env:GOOGLE_APPLICATION_CREDENTIALS
if ([string]::IsNullOrWhiteSpace($firebaseCredentials)) {
  $firebaseCredentials = 'C:\Users\parej\AppData\Local\Pocha\firebase-service-account.json'
}
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$sdkConfigText = firebase apps:sdkconfig android 1:597004870674:android:3b4a0d46557269657ea4cb --project la-pocha-app 2>$null | Out-String
$ErrorActionPreference = $previousErrorActionPreference
if ($sdkConfigText -notmatch '"current_key"\s*:\s*"([^"]+)"') {
  throw 'Firebase Android SDK configuration could not be read'
}
$firebaseApiKey = $Matches[1]

$sql = "ALTER ROLE pocha_staging PASSWORD '$dbPassword';"
wsl.exe -d PochaStaging -- sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 -c $sql | Out-Null
wsl.exe -d PochaStaging -- sudo redis-server --port 6380 --bind 0.0.0.0 --protected-mode no --dir /tmp --dbfilename pocha-staging-smoke.rdb --save '' --appendonly no --requirepass $redisPassword --daemonize yes | Out-Null
Start-Sleep -Seconds 2
$redisPing = (wsl.exe -d PochaStaging -- redis-cli -h 127.0.0.1 -p 6380 --no-auth-warning -a $redisPassword ping 2>$null).Trim()
if ($redisPing -ne 'PONG') {
  throw 'isolated Redis did not start or did not accept its generated password'
}

Set-RequiredEnvironment 'APP_ENV' 'staging'
Set-RequiredEnvironment 'NODE_ENV' 'production'
Set-RequiredEnvironment 'PORT' '3101'
Set-RequiredEnvironment 'DATABASE_URL' "postgresql://pocha_staging:$dbPassword@$wslIp`:5432/pocha_staging?schema=public"
Set-RequiredEnvironment 'REDIS_URL' "redis://:$redisPassword@$wslIp`:6380"
Set-RequiredEnvironment 'REDIS_KEY_PREFIX' $redisNamespace
Set-RequiredEnvironment 'AUTH_PROVIDER' 'external'
Set-RequiredEnvironment 'AUTH_ISSUER_URL' 'https://securetoken.google.com/la-pocha-app'
Set-RequiredEnvironment 'AUTH_AUDIENCE' 'la-pocha-app'
Set-RequiredEnvironment 'GOOGLE_APPLICATION_CREDENTIALS' $firebaseCredentials
Set-RequiredEnvironment 'CORS_ALLOWED_ORIGINS' 'https://staging.local'
Set-RequiredEnvironment 'PUBLIC_BASE_URL' 'https://staging.local'
Set-RequiredEnvironment 'LOG_LEVEL' 'warn'
Set-RequiredEnvironment 'ENABLE_DEBUG_ENDPOINTS' 'false'
Set-RequiredEnvironment 'USER_STORE' 'prisma'
Set-RequiredEnvironment 'GAME_STORE' 'prisma'
Set-RequiredEnvironment 'SEASON_STORE' 'prisma'
Set-RequiredEnvironment 'RANKED_STORE' 'prisma'
Set-RequiredEnvironment 'ROOM_STORE' 'redis'
Set-RequiredEnvironment 'SESSION_LOOKUP_STORE' 'redis'
Set-RequiredEnvironment 'PRESENCE_STORE' 'redis'
Set-RequiredEnvironment 'CASUAL_QUEUE_STORE' 'redis'
Set-RequiredEnvironment 'RANKED_QUEUE_STORE' 'redis'
Set-RequiredEnvironment 'ANALYTICS_PROVIDER' 'noop'
Set-RequiredEnvironment 'METRICS_ENABLED' 'false'
Set-RequiredEnvironment 'ONLINE_ROUND_RESULT_MS' '0'
Set-RequiredEnvironment 'ONLINE_DISCONNECT_GRACE_MS' '60000'
Set-RequiredEnvironment 'ONLINE_BID_TIMEOUT_MS' '1000'
Set-RequiredEnvironment 'ONLINE_PLAY_TIMEOUT_MS' '1000'
Set-RequiredEnvironment 'ONLINE_TRUMP_TIMEOUT_MS' '1000'
Set-RequiredEnvironment 'HEALTH_TIMEOUT_MS' '1500'
Set-RequiredEnvironment 'POCHA_FIREBASE_WEB_API_KEY' $firebaseApiKey
Set-RequiredEnvironment 'STAGING_BASE_URL' 'http://127.0.0.1:3101'

Push-Location $serverRoot
$serverLog = Join-Path $env:TEMP ("pocha-staging-server-" + [guid]::NewGuid().ToString('N') + '.log')
$serverErr = Join-Path $env:TEMP ("pocha-staging-server-" + [guid]::NewGuid().ToString('N') + '.err.log')
$serverProcess = $null
$runFailed = $false
try {
  npm.cmd run prisma:migrate:deploy | Out-Null
  npm.cmd run prisma:generate | Out-Null
  npx.cmd prisma db seed | Out-Null
  npm.cmd run staging:smoke | Out-Null
  $nodePath = (Get-Command node.exe).Source
  $serverProcess = Start-Process -FilePath $nodePath -ArgumentList @('dist/main.js') -WorkingDirectory $serverRoot -RedirectStandardOutput $serverLog -RedirectStandardError $serverErr -PassThru
  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
    Start-Sleep -Seconds 1
    try {
      $probe = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3101/health/ready' -TimeoutSec 2
      if ($probe.StatusCode -eq 200) {
        $ready = $true
        break
      }
    } catch {
      if ($serverProcess.HasExited) { break }
    }
  }
  if (-not $ready) {
    Write-Output 'SERVER_NOT_READY'
    if (Test-Path -LiteralPath $serverErr) {
      Get-Content -LiteralPath $serverErr | Select-Object -Last 80
    }
    throw 'staging server did not become ready'
  }
  npm.cmd run staging:live-smoke
  if ($LASTEXITCODE -ne 0) { throw 'live smoke failed' }
  Assert-RedisFailureAndRecovery
} catch {
  $runFailed = $true
  throw
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
  }
  Pop-Location
  if ($runFailed -and (Test-Path -LiteralPath $serverLog)) {
    Get-Content -LiteralPath $serverLog | Select-Object -Last 100
  }
  if (Test-Path -LiteralPath $serverErr) {
    if ($runFailed) {
      Get-Content -LiteralPath $serverErr | Select-Object -Last 100
    }
    Remove-Item -LiteralPath $serverErr -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path -LiteralPath $serverLog) {
    Remove-Item -LiteralPath $serverLog -Force -ErrorAction SilentlyContinue
  }
  $redisPidText = wsl.exe -d PochaStaging -- pgrep -f 'redis-server 0.0.0.0:6380' 2>$null
  $redisPids = @()
  if (-not [string]::IsNullOrWhiteSpace($redisPidText)) {
    $redisPids = @($redisPidText -split '\s+' | Where-Object { $_ -match '^\d+$' })
  }
  foreach ($isolatedRedisPid in $redisPids) {
    wsl.exe -d PochaStaging -- sudo kill $isolatedRedisPid | Out-Null
  }
}
