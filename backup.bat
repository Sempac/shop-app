@echo off
:: ═══════════════════════════════════════════════════
:: SAUVEGARDE AUTO — The SMARTPHONE POS
:: PostgreSQL dump + nettoyage 30 jours
:: ═══════════════════════════════════════════════════

:: Configuration
set DB_NAME=shop_db
set DB_USER=postgres
set DB_HOST=localhost
set DB_PORT=5432
set BACKUP_DIR=%USERPROFILE%\OneDrive\Backups\smartphone-pos
set DATE=%date:~6,4%-%date:~3,2%-%date:~0,2%
set TIME_STR=%time:~0,2%-%time:~3,2%
set TIME_STR=%TIME_STR: =0%
set FILENAME=backup_%DATE%_%TIME_STR%.sql

:: Créer le dossier si inexistant
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: Log
echo [%DATE% %TIME%] Debut sauvegarde... >> "%BACKUP_DIR%\backup.log"

:: Dump PostgreSQL
set PGPASSWORD=postgres
"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -F c -f "%BACKUP_DIR%\%FILENAME%"

if %ERRORLEVEL% == 0 (
    echo [%DATE% %TIME%] OK - %FILENAME% >> "%BACKUP_DIR%\backup.log"
) else (
    echo [%DATE% %TIME%] ERREUR dump PostgreSQL >> "%BACKUP_DIR%\backup.log"
)

:: Supprimer les fichiers de plus de 30 jours
forfiles /p "%BACKUP_DIR%" /s /m *.sql /d -30 /c "cmd /c del @path" 2>nul

echo [%DATE% %TIME%] Nettoyage 30j termine >> "%BACKUP_DIR%\backup.log"
