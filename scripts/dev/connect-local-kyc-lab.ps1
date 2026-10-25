# Backward-compatible alias. TrọƠi's primary Compose now owns all KYC services.
# Do not start trooi-verify-lab or connect Docker networks manually.
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $repo
try {
    & docker compose up -d
    if ($LASTEXITCODE -ne 0) { throw 'Primary TrọƠi Compose startup failed.' }
    & docker compose ps
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect TrọƠi services.' }
} finally {
    Pop-Location
}
Write-Output 'All default TrọƠi and CompreFace services are managed by the primary Compose.'
