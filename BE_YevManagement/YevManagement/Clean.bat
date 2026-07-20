@echo off
echo Dang tim va xoa cac thu muc bin va obj...

FOR /d /r . %%d in (bin,obj) DO (
    IF EXIST "%%d" (
        echo Xoa: %%d
        rd /s /q "%%d"
    )
)

echo.
echo Da don dep xong!
pause