@echo off
title Sagamente - WhatsApp QR (piloto local)
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-e-iniciar-windows.ps1"
if errorlevel 1 (
  echo.
  echo A ponte nao iniciou. Veja a mensagem de erro acima.
)
echo.
echo Pressione qualquer tecla para fechar esta janela.
pause >nul
