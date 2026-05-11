@echo off
chcp 65001 > nul
echo ========================================
echo  The SMARTPHONE POS
echo ========================================
echo  Arret du serveur precedent...
taskkill /F /IM node.exe > nul 2>&1
timeout /t 2 > nul

echo  Demarrage serveur...
cd /d "C:\Users\sempa\OneDrive\Pro\IT TECH\shop-app"

REM Rendre l'appli accessible via smartphone.local sur le réseau local
REM Ajouter dans C:\Windows\System32\drivers\etc\hosts :
REM 127.0.0.1    smartphone.local

node server.js

echo ========================================
echo  http://localhost:3000
echo  http://smartphone.local:3000
echo  Ctrl+C pour arreter
echo ========================================
pause
