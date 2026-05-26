$WshShell = New-Object -ComObject WScript.Shell
$bureau   = [System.Environment]::GetFolderPath('Desktop')
Write-Host "Bureau: $bureau"

# ── Raccourci : Application des Ventes ──────────────────────
$lnk = $WshShell.CreateShortcut("$bureau\Application des Ventes.lnk")
$lnk.TargetPath       = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$lnk.Arguments        = '--app=http://localhost:3000 --window-size=1400,900 --disable-features=TabStrip'
$lnk.WorkingDirectory = 'C:\Program Files\Google\Chrome\Application'
$lnk.IconLocation     = 'C:\apps\shop-app\app-icon.ico, 0'
$lnk.Description      = 'Application des Ventes'
$lnk.Save()
Write-Host "OK: Application des Ventes.lnk"

# ── Raccourci : Redémarrer le Serveur Appli Vente ───────────
$old = "$bureau\Redemarrer l'Application des Ventes.lnk"
if (Test-Path $old) { Remove-Item $old -Force }

$newName = "Redémarrer le Serveur Appli Vente"
$lnk2 = $WshShell.CreateShortcut("$bureau\$newName.lnk")
$lnk2.TargetPath       = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
$lnk2.Arguments        = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"C:\apps\shop-app\restart-app.ps1`""
$lnk2.WorkingDirectory = 'C:\apps\shop-app'
$lnk2.IconLocation     = 'C:\apps\shop-app\app-icon.ico, 0'
$lnk2.Description      = "Relance le serveur de l'application des ventes"
$lnk2.WindowStyle      = 1
$lnk2.Save()
Write-Host "OK: $newName.lnk"

# ── Barre des tâches : Application des Ventes seulement ─────
$taskbarDir = "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"
if (-not (Test-Path $taskbarDir)) { New-Item -ItemType Directory -Path $taskbarDir -Force | Out-Null }
# Épingler l'appli
Copy-Item "$bureau\Application des Ventes.lnk" "$taskbarDir\Application des Ventes.lnk" -Force
# Retirer le raccourci serveur de la barre (bureau seulement)
Get-ChildItem $taskbarDir -Filter "*Serveur*"    | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem $taskbarDir -Filter "*Redémarrer*" | Remove-Item -Force -ErrorAction SilentlyContinue
Write-Host "Application des Ventes epinglee a la barre des taches."

# Redémarrer Explorer pour appliquer
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800
Start-Process explorer
Write-Host "Terminé."
