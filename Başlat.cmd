@echo off
chcp 65001 >nul
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
if not exist node_modules\electron (
  echo Electron yuklenir, bir neche deqiqe gozleyin...
  call npm install --no-audit --no-fund
)
start "" /b npx electron .
