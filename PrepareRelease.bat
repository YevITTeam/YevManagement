@echo off
setlocal

rem Build BE + FE (goi Deploy.bat) roi gom ket qua ra thu muc goc "_Release\" - dat ten giong
rem het cau truc tren server (_Pending_Backend / _Pending_Frontend) va da co san file trigger
rem deploy.ready ben trong - de ban COPY TAY (qua RDP) thang vao D:\Deploy\ tren server, khong
rem can di qua network share \\10.45.1.49\Deploy nua (dang bi vuong quyen NTFS/Share).
rem
rem AutoDeploy.ps1 tren server van tu dong ap dung binh thuong sau khi ban copy xong, vi no chi
rem quan tam co file deploy.ready trong _Pending_Backend / _Pending_Frontend hay khong.

cd /d "%~dp0"

set "RELEASE_DIR=_Release"

echo ################################################
echo #  Build + gom file ra %RELEASE_DIR%\ de copy tay qua RDP
echo ################################################

echo.
echo [1/2] Dang build BE + FE...
call "%~dp0Deploy.bat"
if errorlevel 1 (
    echo.
    echo [LOI] Build that bai. Dung.
    exit /b 1
)

echo.
echo [2/2] Dang gom file ra %RELEASE_DIR%\ ...

robocopy "yev-backend\publish_backend" "%RELEASE_DIR%\_Pending_Backend" /MIR /NP /NJH
set "RC=%ERRORLEVEL%"
echo   (Robocopy exit code: %RC%)
if %RC% GEQ 8 (
    echo.
    echo [LOI] Gom file BACKEND that bai ^(ma loi %RC%^).
    exit /b 1
)
type nul > "%RELEASE_DIR%\_Pending_Backend\deploy.ready"

robocopy "yev-frontend\out" "%RELEASE_DIR%\_Pending_Frontend" /MIR /NP /NJH
set "RC=%ERRORLEVEL%"
echo   (Robocopy exit code: %RC%)
if %RC% GEQ 8 (
    echo.
    echo [LOI] Gom file FRONTEND that bai ^(ma loi %RC%^).
    exit /b 1
)
type nul > "%RELEASE_DIR%\_Pending_Frontend\deploy.ready"

echo.
echo ################################################
echo #  Xong. Qua RDP vao server, copy TOAN BO noi dung
echo #  (bao gom ca file deploy.ready) sang dung thu muc:
echo #
echo #    %RELEASE_DIR%\_Pending_Backend\*   -^> D:\Deploy\_Pending_Backend\
echo #    %RELEASE_DIR%\_Pending_Frontend\*  -^> D:\Deploy\_Pending_Frontend\
echo #
echo #  AutoDeploy.ps1 se tu phat hien va ap dung trong lan poll
echo #  ke tiep (toi da 5 phut), giong het nhu Release.bat.
echo ################################################
endlocal
exit /b 0
