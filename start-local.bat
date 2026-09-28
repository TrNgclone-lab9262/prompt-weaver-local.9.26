@echo off
chcp 65001 > nul
echo ========================================================
echo   KHỞI ĐỘNG HỆ THỐNG MES NỘI BỘ (DYNAMO LOCAL 100%%)
echo ========================================================
echo.

set "PATH=C:\Program Files\nodejs;%PATH%"

echo Đang mở Local Server tại http://localhost:3000 ...
echo Nhấn Ctrl + C để dừng server khi không sử dụng.
echo.

npm run dev
pause
