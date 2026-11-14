$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root
$Python = Join-Path $Root '.tools\python\python.exe'
if (-not (Test-Path $Python)) {
    $Installer = Join-Path $Root '.tools\python-3.13.5-amd64.exe'
    if (-not (Test-Path $Installer)) { throw 'Stage the official python.org installer in .tools first.' }
    $Target = Join-Path $Root '.tools\python'
    $InstallArguments = @('/quiet', '/norestart', 'InstallAllUsers=0', "TargetDir=$Target",
        'PrependPath=0', 'AppendPath=0', 'AssociateFiles=0', 'Shortcuts=0', 'Include_launcher=0',
        'Include_test=0', 'Include_doc=0', 'Include_tcltk=0', 'Include_dev=0', 'Include_pip=1')
    Write-Output 'Installing project-local CPython; global PATH and launcher are unchanged.'
    $Process = Start-Process -FilePath $Installer -ArgumentList $InstallArguments -PassThru -Wait
    if ($Process.ExitCode -notin @(0,3010)) { throw "Python installer exit code: $($Process.ExitCode)" }
    if (-not (Test-Path $Python)) { throw 'Project-local Python executable was not created.' }
}
& $Python --version
& (Join-Path $PSScriptRoot 'deploy_windows.ps1') -InstallOnly
exit $LASTEXITCODE
