$ErrorActionPreference = 'Stop'
$port = 4177
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = 'http://127.0.0.1:' + $port
$online = $false

try {
    $response = Invoke-WebRequest -Uri ($url + '/api/devices') -UseBasicParsing -TimeoutSec 2
    $online = $response.StatusCode -eq 200
} catch {
    $online = $false
}

if (-not $online) {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Host 'Node.js was not found on PATH. Install Node.js or use Android Studio terminal.' -ForegroundColor Red
        exit 1
    }
    $script = Join-Path $base 'server.cjs'
    Start-Process -FilePath $node.Source -ArgumentList @($script) -WorkingDirectory $base -WindowStyle Hidden | Out-Null
    $connected = $false
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 350
        try {
            $response = Invoke-WebRequest -Uri ($url + '/api/devices') -UseBasicParsing -TimeoutSec 1
            if ($response.StatusCode -eq 200) { $connected = $true; break }
        } catch {}
    }
    if (-not $connected) {
        Write-Host 'Local test server did not start. Check port 4177 and Android SDK.' -ForegroundColor Red
        exit 1
    }
}
Start-Process $url
Write-Host ('TrọƠi test controls are ready: ' + $url) -ForegroundColor Green
