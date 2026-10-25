# Provision one synthetic local-only operator, without writing a password into source,
# shell history, logs or the production Google verification tables.
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repo
$envFile = Join-Path $repo '.env'
$state = [IO.File]::ReadAllText($envFile)
if ($state -notmatch 'DATABASE_URL=') { throw 'Local DATABASE_URL is missing' }
$secret = Read-Host -AsSecureString 'Nhap mat khau CHI DUNG LOCAL cho tai khoan chu tro thu nghiem'
$pointer = [IntPtr]::Zero
try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    $env:TROOI_LOCAL_DEV_SEED_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $env:TROOI_DATABASE_MODE = 'compose-postgres'
    $env:TROOI_LOCAL_DEMO_AUTH = 'true'
    & node --env-file=.env scripts/dev/seed-local-demo-owner.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Database owner provisioning failed' }
} finally {
    if ($pointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
    Remove-Item Env:TROOI_LOCAL_DEV_SEED_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:TROOI_DATABASE_MODE -ErrorAction SilentlyContinue
    Remove-Item Env:TROOI_LOCAL_DEMO_AUTH -ErrorAction SilentlyContinue
}
$state = [IO.File]::ReadAllText($envFile)
if ($state -match '(?m)^TROOI_LOCAL_DEMO_AUTH=') {
    $state = [regex]::Replace($state, '(?m)^TROOI_LOCAL_DEMO_AUTH=.*$', 'TROOI_LOCAL_DEMO_AUTH=true')
} else {
    $state = $state.TrimEnd() + "`nTROOI_LOCAL_DEMO_AUTH=true`n"
}
[IO.File]::WriteAllText($envFile,$state,[Text.UTF8Encoding]::new($false))
& docker compose up -d --build backend
if ($LASTEXITCODE -ne 0) { throw 'Backend could not start' }
Write-Output 'LOCAL_DEV_OWNER_READY=YES'
Write-Output 'Local credential is stored as scrypt hash, never as plaintext.'
Write-Output 'Only local Docker Compose is permitted; no government or Google verification has been forged.'
