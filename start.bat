@echo off
rem Double-click to start GRIT Interviews. Passes any options through, e.g. start.bat -Reset
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
if errorlevel 1 pause
