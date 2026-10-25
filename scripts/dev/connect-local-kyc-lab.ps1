# Restore local-only CompreFace bridge after Docker Desktop restarts.
# Never deletes/reset tro-oi and never prints the lab API key.
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$lab = 'D:\Projects\.temp\TroOi-Account-Verification-Lab\CompreFace-release\runtime'
if (!(Test-Path (Join-Path $lab 'docker-compose.yml'))) { throw 'Local CompreFace lab not installed.' }
if (-not (Select-String -Path (Join-Path $lab '.env') -Pattern '^save_images_to_db=false\s*$' -Quiet)) {
    throw 'CompreFace must not persist identity images.'
}
Push-Location $lab
try {
    & docker compose -p trooi-verify-lab -f docker-compose.yml up -d
    if ($LASTEXITCODE -ne 0) { throw 'CompreFace startup failed.' }
} finally { Pop-Location }
Push-Location $repo
try {
    & docker compose up -d backend
    if ($LASTEXITCODE -ne 0) { throw 'TrọƠi backend startup failed.' }
} finally { Pop-Location }
$name = 'trooi-project-backend-1'
$network = 'trooi-verify-lab_default'
$attached = (& docker inspect $name --format '{{json .NetworkSettings.Networks}}') -join ''
if ($attached -notmatch [regex]::Escape($network)) {
    & docker network connect $network $name
    if ($LASTEXITCODE -ne 0) { throw 'Private CompreFace network connection failed.' }
}
& docker exec $name node -e "fetch('http://compreface-fe/',{signal:AbortSignal.timeout(10000)}).then(r=>{console.log('CompreFace: HTTP '+r.status);if(!r.ok)process.exitCode=1}).catch(()=>process.exitCode=2)"
if ($LASTEXITCODE -ne 0) { throw 'CompreFace health check failed.' }
Write-Output 'Local automatic KYC bridge ready.'
