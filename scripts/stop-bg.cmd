@echo off
setlocal EnableExtensions
chcp 65001 >nul
echo [CMG WMS] 正在停止 3001 / 8080 ...

for %%P in (3001 8080) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
    echo 结束 PID %%A (port %%P)
    taskkill /F /PID %%A >nul 2>&1
  )
)

REM also kill child node if still around - optional soft
echo 完成。
timeout /t 2 >nul
exit /b 0
