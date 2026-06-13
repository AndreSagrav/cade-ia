@echo off
setlocal
cd /d "%~dp0"
echo Installing dependencies...
if not exist "node_modules" (
  call npm ci || goto :end
)
echo Building client and server...
call npm run build || goto :end
call npm run build:server
echo Packaging Electron app...
call npm run electron:build || goto :end
set UNPACKED="%~dp0dist-electron\win-unpacked\CodeAI Studio.exe"
if exist %UNPACKED% (
  echo Running unpacked app...
  start "" %UNPACKED%
  goto :end
)
for /f "delims=" %%F in ('dir /b /od "%~dp0dist-electron\CodeAI Studio*.exe" 2^>NUL') do set SETUP=%%F
if defined SETUP (
  echo Launching installer or portable: %SETUP%
  start "" "%~dp0dist-electron\%SETUP%"
) else (
  echo No executable found in dist-electron. Please check build output.
)
:end
endlocal
