# setup-watchdog.ps1 — A lancer EN ADMIN sur le PC prod
# Installe le watchdog comme tâche planifiée au démarrage

$appPath = "C:\apps\shop-app"
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) { Write-Error "Node.js introuvable"; exit 1 }

$action   = New-ScheduledTaskAction -Execute $nodePath -Argument "$appPath\watchdog.js" -WorkingDirectory $appPath
$trigger  = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal= New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest

Register-ScheduledTask -TaskName "ShopAppWatchdog" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force
Start-ScheduledTask -TaskName "ShopAppWatchdog"

Write-Host "✅ Watchdog installé et démarré sur le port 3001" -ForegroundColor Green
Write-Host "   Accès : http://<IP-Tailscale>:3001" -ForegroundColor Cyan
Write-Host "   Token : restart2025" -ForegroundColor Yellow
