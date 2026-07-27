@echo off
setlocal enabledelayedexpansion

rem Build BE + FE (goi Deploy.bat) roi day ket qua len thu muc Pending tren share deploy,
rem sau do tao trigger deploy.ready de AutoDeploy.ps1 tren server tu ap dung vao site live.
rem LUU Y: script nay CHI day file len share - viec ap dung vao IIS phu thuoc AutoDeploy.ps1
rem co dang chay (Task Scheduler) tren server hay khong.

cd /d "%~dp0"

set "DEPLOY_SHARE=\\10.45.1.49\Deploy"
set "BE_SRC=yev-backend\publish_backend"
set "FE_SRC=yev-frontend\out"
set "BE_DST=%DEPLOY_SHARE%\_Pending_Backend"
set "FE_DST=%DEPLOY_SHARE%\_Pending_Frontend"

echo ################################################
echo #  RELEASE - Build + Day len %DEPLOY_SHARE%
echo ################################################

echo.
echo [1/3] Dang build BE + FE...
call "%~dp0Deploy.bat"
if errorlevel 1 (
    echo.
    echo [LOI] Build that bai. Dung, khong day len server.
    exit /b 1
)

if not exist "%DEPLOY_SHARE%" (
    echo.
    echo [LOI] Khong truy cap duoc "%DEPLOY_SHARE%". Kiem tra ket noi mang / quyen truy cap.
    exit /b 1
)

rem Kiem tra co ghi duoc vao thu muc dich khong TRUOC khi robocopy - de bao loi ro rang
rem thay vi de robocopy tu retry 3 lan/5 giay roi moi bao (va tranh phu thuoc doan robocopy
rem exit code that thuong khong set dung bit fatal khi dich la thu muc goc bi tu choi truy cap).
call :CheckWritable "%BE_DST%" "BACKEND"
if errorlevel 1 exit /b 1
call :CheckWritable "%FE_DST%" "FRONTEND"
if errorlevel 1 exit /b 1

echo.
echo [2/3] Dang day BACKEND len Pending ("%BE_DST%")...
robocopy "%BE_SRC%" "%BE_DST%" /MIR /R:3 /W:5 /NP /NJH
set "RC=%ERRORLEVEL%"
echo   (Robocopy exit code: %RC%)
if %RC% GEQ 8 (
    echo.
    echo [LOI] Robocopy BACKEND that bai ^(ma loi %RC%^). Dung, khong tao trigger.
    exit /b 1
)
type nul > "%BE_DST%\deploy.ready"

echo.
echo [3/3] Dang day FRONTEND len Pending ("%FE_DST%")...
robocopy "%FE_SRC%" "%FE_DST%" /MIR /R:3 /W:5 /NP /NJH
set "RC=%ERRORLEVEL%"
echo   (Robocopy exit code: %RC%)
if %RC% GEQ 8 (
    echo.
    echo [LOI] Robocopy FRONTEND that bai ^(ma loi %RC%^). Dung, khong tao trigger.
    exit /b 1
)
type nul > "%FE_DST%\deploy.ready"

echo.
echo ################################################
echo #  Hoan tat. AutoDeploy.ps1 tren server se
echo #  tu dong ap dung ban moi trong lan poll ke tiep.
echo ################################################
endlocal
exit /b 0

:CheckWritable
setlocal
set "TESTDIR=%~1"
set "LABEL=%~2"
if not exist "%TESTDIR%" mkdir "%TESTDIR%" 2>nul
type nul > "%TESTDIR%\.write_test.tmp" 2>nul
if not exist "%TESTDIR%\.write_test.tmp" (
    echo.
    echo [LOI] Khong co quyen ghi vao "%TESTDIR%" ^(%LABEL%^). Kiem tra NTFS + Share permissions tren server.
    endlocal
    exit /b 1
)
del /f /q "%TESTDIR%\.write_test.tmp" >nul 2>&1
endlocal
exit /b 0
