@echo off
taskkill /F /IM node.exe 2>NUL
taskkill /F /IM chrome.exe 2>NUL
cd /d C:\apps\shop-app
node server.js > C:\apps\shop-app\server.log 2>&1
