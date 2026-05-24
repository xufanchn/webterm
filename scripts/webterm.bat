@echo off
cd /d "%~dp0"

for /f "tokens=2" %%a in ('findstr /r "port:" config.yaml') do set PORT=%%a
if "%PORT%"=="" set PORT=8443

echo Starting webterm on http://localhost:%PORT% ...
start "" "http://localhost:%PORT%"
webterm.exe -config config.yaml
pause
