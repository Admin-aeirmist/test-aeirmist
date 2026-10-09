@echo off
title Aeirmist Online Cloudflare Tunnel (aeirmist.com)
echo =========================================================
echo    Starting Cloudflare Tunnel for aeirmist.com
echo    Route: https://aeirmist.com -> http://localhost:4000
echo =========================================================
cd /d D:\Aeirmist
"D:\Aeirmist\cloudflared.exe" tunnel run --token eyJhIjoiYmQ3MTI0NmViMDkwMTVmZTczN2U0YjZlYmU2OTRjZTciLCJ0IjoiNjAwNTZmNjktNjkwYy00ZDUzLWE5YWEtNGE5NWEwMjE0ODYyIiwicyI6Ii9PRjdqUTByZGd6NUNkQVhMRVRpUDBZZ2wzV2lJQzZNd0NRdVdJZmVqeTA9In0=
