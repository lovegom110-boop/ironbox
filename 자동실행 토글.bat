@echo off
REM IRONBOX widget - autostart ON/OFF toggle (double-click)
title IRONBOX widget autostart
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0autostart-toggle.ps1"
echo.
pause
