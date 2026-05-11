@echo off
echo ========================================
echo  Configuration smartphone.local
echo ========================================
echo.
echo Ce script doit etre execute en ADMINISTRATEUR
echo.
REM Ajouter smartphone.local dans le fichier hosts
echo 127.0.0.1    smartphone.local >> C:\Windows\System32\drivers\etc\hosts
echo.
echo ✅ smartphone.local configure !
echo    Vous pouvez maintenant acceder a l'appli via :
echo    http://smartphone.local:3000
echo.
echo    Pour que les autres appareils du reseau y accedent :
echo    Remplacez 127.0.0.1 par l'IP de ce PC dans hosts
echo    ou utilisez directement : http://[IP-DU-PC]:3000
echo.
pause
