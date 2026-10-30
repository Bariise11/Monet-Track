@echo off
rem Starts Money Track in fast (production) mode. Double-click this file.
rem Use "start.bat rebuild" after the code has changed.
cd /d "%~dp0"

if /i "%1"=="rebuild" (
  echo Building...
  call npm run build
  if errorlevel 1 goto :fail
) else if not exist ".next\BUILD_ID" (
  echo First start: building the fast version. This takes about a minute...
  call npm run build
  if errorlevel 1 goto :fail
)

start "" http://localhost:3000
echo.
echo Money Track is running at http://localhost:3000
echo Close this window to stop it.
echo.
call npm start
goto :eof

:fail
echo.
echo The build failed. Scroll up to see why.
pause
