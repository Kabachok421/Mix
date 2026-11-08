@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Mix: сборка установщика для Windows ===
where node >nul 2>nul || (echo Node.js не найден. Установите Node.js 20 или новее: https://nodejs.org & goto :err)

echo.
echo [1/3] Зависимости веб-клиента...
call npm install || goto :err

echo.
echo [2/3] Зависимости десктопной оболочки...
cd desktop
call npm install || goto :err

echo.
echo [3/3] Сборка клиента и установщика...
call npm run dist || goto :err

echo.
echo Готово. Установщик: desktop\release\Mix-Setup-1.0.0.exe
explorer release
pause
exit /b 0

:err
echo.
echo ОШИБКА СБОРКИ. Если в тексте выше есть "Cannot create symbolic link":
echo запустите этот файл от имени администратора или включите "Режим разработчика" в Параметрах Windows.
pause
exit /b 1
