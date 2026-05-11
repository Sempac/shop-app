@echo off
echo ========================================
echo  Configuration fichier .env
echo ========================================
cd /d C:\Dev\shop-app

:: Créer le fichier .env avec les variables sensibles
echo DB_HOST=localhost > .env
echo DB_PORT=5432 >> .env
echo DB_USER=postgres >> .env
echo DB_PASSWORD=Sempac >> .env
echo DB_NAME=shop_db >> .env
echo PORT=3000 >> .env

echo ✅ Fichier .env créé !
echo.
echo IMPORTANT : Ce fichier ne sera PAS envoyé sur GitHub
pause
