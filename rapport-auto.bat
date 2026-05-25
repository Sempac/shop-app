@echo off
:: ═══════════════════════════════════════════════════
:: RAPPORT COMPTABLE AUTO — The SMARTPHONE POS
:: Génère le PDF + envoie par email en fin de journée
:: ═══════════════════════════════════════════════════

set LOG_DIR=C:\apps\shop-app\rapports
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: Date du jour au format YYYY-MM-DD
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set DT=%%I
set TODAY=%DT:~0,4%-%DT:~4,2%-%DT:~6,2%

echo [%DATE% %TIME%] Lancement rapport auto %TODAY%... >> "%LOG_DIR%\rapport-auto.log"

:: Appel de l'API (curl inclus dans Windows 10+)
curl -s -o "%LOG_DIR%\rapport-auto-result.json" -w "%%{http_code}" "http://localhost:3000/api/rapport-comptable/generer?date=%TODAY%" > "%LOG_DIR%\rapport-auto-status.txt" 2>&1

set /p STATUS=< "%LOG_DIR%\rapport-auto-status.txt"

if "%STATUS%"=="200" (
    echo [%DATE% %TIME%] OK - Rapport %TODAY% genere et envoye >> "%LOG_DIR%\rapport-auto.log"
) else (
    echo [%DATE% %TIME%] ERREUR HTTP %STATUS% - voir rapport-auto-result.json >> "%LOG_DIR%\rapport-auto.log"
)
