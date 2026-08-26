[CmdletBinding()]
param(
  [ValidateSet('status', 'migrate', 'smoke')]
  [string] $Action = 'smoke'
)

$ErrorActionPreference = 'Stop'

function Get-RequiredUserEnvironment([string] $Name) {
  $value = [Environment]::GetEnvironmentVariable($Name, 'User')
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Falta la variable de usuario $Name."
  }
  return $value
}

# Las credenciales se mantienen en las variables de usuario de Windows y no en
# el repositorio. Este script solo las copia al proceso npm que se ejecuta.
$env:DATABASE_URL = Get-RequiredUserEnvironment 'POCHA_STAGING_DATABASE_URL'
$env:REDIS_URL = Get-RequiredUserEnvironment 'POCHA_STAGING_REDIS_URL'
$env:APP_ENV = 'staging'
$env:NODE_ENV = 'production'
$env:REDIS_KEY_PREFIX = 'staging-pocha'

switch ($Action) {
  'status' {
    npm run prisma:migrate:status
  }
  'migrate' {
    npm run prisma:migrate:deploy
  }
  'smoke' {
    npm run prisma:migrate:status
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run staging:smoke
  }
}

exit $LASTEXITCODE
