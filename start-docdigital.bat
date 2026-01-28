@echo off
REM ----- Backend (Express + SQLite) -----
cd /d C:\Users\Usuario\Desktop\docdigital\backend
start cmd /k "npm run dev"

REM ----- Frontend (VSCode con el HTML) -----
cd /d C:\Users\Usuario\Desktop\docdigital\frontend
start "" "C:\Users\Usuario\AppData\Local\Programs\Microsoft VS Code\Code.exe" docdigital-demo-v2.html

echo Backend y VSCode iniciados. Pulsa una tecla para cerrar esta ventana...
pause >nul
