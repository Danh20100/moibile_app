$ErrorActionPreference = "Stop"
if (-not (Get-Command gradle -ErrorAction SilentlyContinue)) {
    throw "Gradle is not available. Install Gradle 9.4.1 or copy an existing Gradle wrapper into this folder."
}
gradle wrapper --gradle-version 9.4.1
Write-Host "Gradle wrapper created."
