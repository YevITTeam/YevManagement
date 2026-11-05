@echo off
setlocal

rem Build & publish CompanySystem.HostApi (Release), roi thay web.config bang
rem ban deploy dung o docs/deploy-config/config-be/web.config.

cd /d "%~dp0"

set "OUT_DIR=publish_backend"
set "CONFIG_SRC=..\docs\deploy-config\config-be\web.config"

echo ============================================
echo   BUILD BACKEND - CompanySystem.HostApi
echo ============================================

echo.
echo [0/2] Dang dong goi bo tao PDF phieu tang ca (pdf-renderer + node.exe)...
call pnpm --dir ..\yev-frontend install
if errorlevel 1 (
    echo [LOI] pnpm install that bai.
    exit /b 1
)
call pnpm --dir ..\yev-frontend run build:pdf-renderer --with-node
if errorlevel 1 (
    echo [LOI] Dong goi pdf-renderer that bai.
    exit /b 1
)

echo.
echo [1/2] Dang publish (Release) vao %OUT_DIR% ...
dotnet publish "CompanySystem.HostApi\CompanySystem.HostApi.csproj" -c Release -o "%OUT_DIR%"
if errorlevel 1 (
    echo.
    echo [LOI] Publish that bai. Dung script.
    exit /b 1
)

echo.
echo [2/2] Dang thay the web.config bang ban deploy...
if not exist "%CONFIG_SRC%" (
    echo [LOI] Khong tim thay file "%CONFIG_SRC%"
    exit /b 1
)
copy /y "%CONFIG_SRC%" "%OUT_DIR%\web.config" >nul
if errorlevel 1 (
    echo [LOI] Copy web.config that bai.
    exit /b 1
)

echo.
echo Hoan tat. Ket qua publish nam tai: %OUT_DIR%
endlocal
