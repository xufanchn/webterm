@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

for /f "tokens=2" %%a in ('findstr /r "port:" config.yaml 2^>nul') do set PORT=%%a
if "%PORT%"=="" set PORT=8443

if "%~1"=="stop" goto stop
if "%~1"=="restart" goto restart
if "%~1"=="status" goto status
if "%~1"=="start" goto start

:foreground
echo Starting webterm on http://localhost:%PORT% ...
start "" "http://localhost:%PORT%"
webterm.exe -config config.yaml
pause
goto :eof

:start
tasklist /fi "imagename eq webterm.exe" 2>nul | find /i "webterm.exe" >nul
if %errorlevel%==0 (
    echo webterm is already running
    goto :eof
)
echo Starting webterm on http://localhost:%PORT% ...
start "" /b webterm.exe -config config.yaml > webterm.log 2>&1
timeout /t 1 /nobreak >nul
tasklist /fi "imagename eq webterm.exe" 2>nul | find /i "webterm.exe" >nul
if %errorlevel%==0 (
    echo ok
) else (
    echo failed — check webterm.log
)
goto :eof

:stop
tasklist /fi "imagename eq webterm.exe" 2>nul | find /i "webterm.exe" >nul
if %errorlevel% neq 0 (
    echo webterm is not running
    goto :eof
)
echo Stopping webterm ...
taskkill /im webterm.exe /f >nul 2>&1 && echo ok || echo failed
goto :eof

:restart
call :stop_impl
timeout /t 1 /nobreak >nul
call :start_impl
goto :eof

:stop_impl
taskkill /im webterm.exe /f >nul 2>&1
goto :eof

:start_impl
start "" /b webterm.exe -config config.yaml > webterm.log 2>&1
goto :eof

:status
tasklist /fi "imagename eq webterm.exe" 2>nul | find /i "webterm.exe" >nul
if %errorlevel%==0 (
    echo webterm is running on http://localhost:%PORT%
) else (
    echo webterm is stopped
)
goto :eof
