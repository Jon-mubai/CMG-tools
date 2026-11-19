@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
for %%I in ("%SCRIPT_DIR%\..") do set "ROOT=%%~fI"
set "LOGDIR=%SCRIPT_DIR%\logs"
set "RUNDIR=%SCRIPT_DIR%\.run"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
if not exist "%RUNDIR%" mkdir "%RUNDIR%"
set "BOOT=%LOGDIR%\bootstrap.log"

> "%BOOT%" echo [%date% %time%] SCRIPT_DIR=%SCRIPT_DIR%
>>"%BOOT%" echo [%date% %time%] ROOT=%ROOT%

if not exist "%ROOT%\apps\api\package.json" (
  >>"%BOOT%" echo [%date% %time%] ERROR missing apps\api\package.json
  echo [ERROR] Missing: %ROOT%\apps\api\package.json
  echo Put this script under: project\scripts\
  pause
  exit /b 1
)
if not exist "%ROOT%\apps\web\package.json" (
  >>"%BOOT%" echo [%date% %time%] ERROR missing apps\web\package.json
  echo [ERROR] Missing: %ROOT%\apps\web\package.json
  pause
  exit /b 1
)

set "NPM="
where npm.cmd >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%A in ('where npm.cmd') do (
    if not defined NPM set "NPM=%%A"
  )
)
if not defined NPM if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPM if exist "%LocalAppData%\Programs\node\npm.cmd" set "NPM=%LocalAppData%\Programs\node\npm.cmd"
if not defined NPM (
  >>"%BOOT%" echo [%date% %time%] ERROR npm not found
  echo [ERROR] npm not found. Install Node.js and check PATH.
  pause
  exit /b 2
)
>>"%BOOT%" echo [%date% %time%] NPM=%NPM%

if not exist "%ROOT%\apps\api\.env" (
  if exist "%ROOT%\apps\api\.env.example" (
    copy /y "%ROOT%\apps\api\.env.example" "%ROOT%\apps\api\.env" >nul
    >>"%BOOT%" echo [%date% %time%] copied .env.example
  )
)

REM helper launchers (avoid nested-quote hell)
> "%LOGDIR%\_run_api.cmd" echo @echo off
>>"%LOGDIR%\_run_api.cmd" echo cd /d "%ROOT%\apps\api"
>>"%LOGDIR%\_run_api.cmd" echo call "%NPM%" run start:dev
> "%LOGDIR%\_run_web.cmd" echo @echo off
>>"%LOGDIR%\_run_web.cmd" echo cd /d "%ROOT%\apps\web"
>>"%LOGDIR%\_run_web.cmd" echo call "%NPM%" run dev

netstat -ano | findstr /R /C:":3001 .*LISTENING" >nul 2>&1
if errorlevel 1 (
  >>"%BOOT%" echo [%date% %time%] starting API on 3001
  start "CMG-API" /MIN cmd /c ""%LOGDIR%\_run_api.cmd" >>"%LOGDIR%\api.out.log" 2>>"%LOGDIR%\api.err.log""
) else (
  >>"%BOOT%" echo [%date% %time%] skip API port 3001 busy
)

netstat -ano | findstr /R /C:":8080 .*LISTENING" >nul 2>&1
if errorlevel 1 (
  >>"%BOOT%" echo [%date% %time%] starting Web on 8080
  start "CMG-WEB" /MIN cmd /c ""%LOGDIR%\_run_web.cmd" >>"%LOGDIR%\web.out.log" 2>>"%LOGDIR%\web.err.log""
) else (
  >>"%BOOT%" echo [%date% %time%] skip Web port 8080 busy
)

>>"%BOOT%" echo [%date% %time%] done OK
echo.
echo ========================================
echo   Started (minimized windows)
echo   Web: http://127.0.0.1:8080
echo   API: http://127.0.0.1:3001/api/v1
echo   Log: %LOGDIR%\bootstrap.log
echo ========================================
echo.
timeout /t 3 >nul
exit /b 0
