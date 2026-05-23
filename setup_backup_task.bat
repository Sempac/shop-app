@echo off
:: ═══════════════════════════════════════════════════
:: INSTALLATION TÂCHE PLANIFIÉE WINDOWS
:: Exécuter en tant qu'Administrateur
:: ═══════════════════════════════════════════════════

set TASK_NAME=SmartphonePOS_Backup
set SCRIPT_PATH=C:\apps\shop-app\backup.bat

:: Supprimer l'ancienne tâche si elle existe
schtasks /delete /tn "%TASK_NAME%" /f 2>nul

:: Créer la tâche planifiée — tous les jours à 2h du matin
schtasks /create /tn "%TASK_NAME%" /tr "%SCRIPT_PATH%" /sc daily /st 02:00 /ru SYSTEM /f

if %ERRORLEVEL% == 0 (
    echo Tache planifiee creee avec succes!
    echo Sauvegarde automatique tous les jours a 2h du matin
    echo Fichiers: %USERPROFILE%\OneDrive\Backups\smartphone-pos\
) else (
    echo ERREUR - Executez en tant qu'Administrateur
)

:: Tester immédiatement
echo.
set /p TEST="Lancer un test de sauvegarde maintenant? (oui/non): "
if /i "%TEST%"=="oui" (
    call "%SCRIPT_PATH%"
    echo Test termine - verifiez OneDrive\Backups\smartphone-pos\
)

pause
