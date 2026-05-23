@echo off
:: ═══════════════════════════════════════════════════
:: RESTAURATION — The SMARTPHONE POS
:: Usage: restore.bat [nom_fichier.sql]
:: ═══════════════════════════════════════════════════

set DB_NAME=shop_db
set DB_USER=postgres
set DB_HOST=localhost
set DB_PORT=5432
set BACKUP_DIR=%USERPROFILE%\OneDrive\Backups\smartphone-pos

if "%1"=="" (
    echo Fichiers disponibles:
    dir "%BACKUP_DIR%\*.sql" /b /o:-d
    echo.
    set /p FILENAME="Entrez le nom du fichier a restaurer: "
) else (
    set FILENAME=%1
)

echo ATTENTION: Cela va ecraser la base %DB_NAME% !
set /p CONFIRM="Confirmer? (oui/non): "
if /i not "%CONFIRM%"=="oui" goto :end

set PGPASSWORD=postgres
"C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% --clean --if-exists "%BACKUP_DIR%\%FILENAME%"

if %ERRORLEVEL% == 0 (
    echo Restauration OK!
) else (
    echo ERREUR lors de la restauration
)

:end
pause
