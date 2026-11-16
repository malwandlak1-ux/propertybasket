# Runs the Expo build tool (EAS CLI) with Node and Git on PATH, which they
# are not by default on this machine.
#
#   powershell -ExecutionPolicy Bypass -File .\eas.ps1 login
#   powershell -ExecutionPolicy Bypass -File .\eas.ps1 build -p android --profile preview
#
$env:Path = 'C:\Program Files\nodejs;C:\Program Files\Git\cmd;' + $env:Path
Set-Location $PSScriptRoot
& npx.cmd --yes eas-cli@latest @args
exit $LASTEXITCODE
