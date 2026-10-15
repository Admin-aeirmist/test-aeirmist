@echo off
title Aeirmist Full-Stack Launcher
echo Starting Aeirmist services...
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\start-services.ps1"
pause
