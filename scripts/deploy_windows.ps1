param([string]$PythonVersion = '3.13.13', [switch]$InstallOnly)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$env:PYTHONUTF8 = '1'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root
$Output = Join-Path $Root 'validation_windows'
New-Item -ItemType Directory -Force -Path $Output | Out-Null

function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code $LASTEXITCODE : $Executable" }
}

$ToolRoot = Join-Path $Root '.tools'
$Uv = Join-Path $ToolRoot 'uv.exe'
New-Item -ItemType Directory -Force -Path $ToolRoot | Out-Null
if (-not (Test-Path $Uv)) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $Archive = Join-Path $ToolRoot 'uv-windows.zip'
    Write-Output 'Downloading isolated uv runtime from astral-sh/uv'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip' -OutFile $Archive -TimeoutSec 120
    Expand-Archive -LiteralPath $Archive -DestinationPath $ToolRoot -Force
    if (-not (Test-Path $Uv)) {
        $Found = Get-ChildItem -Path $ToolRoot -Recurse -Filter uv.exe | Select-Object -First 1
        if (-not $Found) { throw 'uv.exe not found in the downloaded archive' }
        Copy-Item -LiteralPath $Found.FullName -Destination $Uv
    }
    Remove-Item -LiteralPath $Archive
}
$env:UV_CACHE_DIR = Join-Path $Root '.cache\uv'
$env:UV_PYTHON_INSTALL_DIR = Join-Path $Root '.python'
$env:UV_PYTHON_BIN_DIR = Join-Path $Root '.python-bin'
Invoke-Checked $Uv @('--version')
$PortablePython = Join-Path $ToolRoot 'python\python.exe'
if (Test-Path $PortablePython) {
    $PythonBase = $PortablePython
} else {
    Invoke-Checked $Uv @('python', 'install', $PythonVersion)
    $PythonBase = $PythonVersion
}
$Python = Join-Path $Root '.venv\Scripts\python.exe'
if (-not (Test-Path $Python)) {
    Invoke-Checked $Uv @('venv', '--seed', '--python', $PythonBase, '.venv')
}
$Gcc = Get-Command g++ -ErrorAction SilentlyContinue
if ($Gcc) {
    $env:CXX = $Gcc.Source
    Invoke-Checked $Python @('scripts\build_native.py')
} else {
    Write-Output 'No MinGW C++ compiler available: deploying CPU FFT; native DLL tests will report skipped.'
    @{native_built=$false;reason='No MinGW compiler on PATH';cpu_fft_available=$true} | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $Output 'native_build.json')
}
Invoke-Checked $Uv @('pip', 'install', '--python', $Python, '-c', 'requirements-tested.txt', '.[test]', 'mcp==1.26.0')
if (-not $InstallOnly) {
    Invoke-Checked $Python @('scripts\validate_deployment.py', '--output-dir', $Output)
    Write-Output 'Native Windows deployment finished. Web: http://127.0.0.1:8875 ; MCP: http://127.0.0.1:8876/mcp'
} else {
    Write-Output 'Native Windows isolated environment installed; validation has not run yet.'
}
