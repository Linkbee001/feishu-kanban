$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot

Push-Location $repoRoot
try {
  Write-Host '[1/3] Verifying Pi Mono adapter focused tests...' -ForegroundColor Cyan
  npm run test:pi-runtime
  if ($LASTEXITCODE -ne 0) {
    throw 'Pi Mono adapter tests failed.'
  }

  Write-Host '[2/3] Verifying group runtime service and Feishu event flow...' -ForegroundColor Cyan
  npm run test:group-runtime
  if ($LASTEXITCODE -ne 0) {
    throw 'Group runtime tests failed.'
  }

  Write-Host '[3/3] Building Nest application...' -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) {
    throw 'Build failed.'
  }

  Write-Host 'Pi Mono and group runtime verification passed.' -ForegroundColor Green
} finally {
  Pop-Location
}
