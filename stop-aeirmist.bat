@echo off
title Aeirmist Service Stopper
echo Stopping Aeirmist services...
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\stop-services.ps1"
pause
