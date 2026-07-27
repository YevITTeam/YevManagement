@echo off
setlocal

rem Build toan bo du an (BE + FE) cho deploy.
rem  - BE : yev-backend\Publish.bat  -> yev-backend\publish_backend\
rem  - FE : yev-frontend\Publish.bat -> yev-frontend\out\

cd /d "%~dp0"

echo ################################################
echo #  DEPLOY BUILD - YEV Management (BE + FE)
echo ################################################

echo.
call "yev-backend\Publish.bat"
if errorlevel 1 (
    echo.
    echo [LOI] Build backend that bai. Dung.
    exit /b 1
)

echo.
call "yev-frontend\Publish.bat"
if errorlevel 1 (
    echo.
    echo [LOI] Build frontend that bai. Dung.
    exit /b 1
)

echo.
echo ################################################
echo #  Hoan tat. BE: yev-backend\publish_backend\
echo #             FE: yev-frontend\out\
echo ################################################
endlocal
