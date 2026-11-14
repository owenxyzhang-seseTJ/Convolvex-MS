$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
& '.\.venv\Scripts\python.exe' 'scripts\local_services.py' stop
exit $LASTEXITCODE
