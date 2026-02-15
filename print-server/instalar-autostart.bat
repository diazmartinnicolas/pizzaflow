@echo off
:: ============================================================
:: Instala el print-server de Fluxo para que inicie
:: automáticamente con Windows (en la bandeja, sin ventana visible)
:: Ejecutar UNA SOLA VEZ como administrador
:: ============================================================

set TASK_NAME=FluxoPrintServer
set BAT_PATH=%~dp0iniciar-print-server-silent.vbs

:: Crear el VBScript que ejecuta el BAT sin ventana
echo Set WshShell = CreateObject("WScript.Shell") > "%~dp0iniciar-print-server-silent.vbs"
echo WshShell.Run chr(34) ^& "%~dp0iniciar-print-server.bat" ^& chr(34), 0 >> "%~dp0iniciar-print-server-silent.vbs"
echo Set WshShell = Nothing >> "%~dp0iniciar-print-server-silent.vbs"

:: Registrar en el inicio de Windows (carpeta Startup)
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
copy "%~dp0iniciar-print-server-silent.vbs" "%STARTUP_DIR%\FluxoPrintServer.vbs" /Y

echo.
echo ✅ Listo! El print server de Fluxo se iniciará
echo    automáticamente cada vez que prendas la PC.
echo.
echo    Para desactivarlo, eliminá el archivo:
echo    %STARTUP_DIR%\FluxoPrintServer.vbs
echo.
pause
