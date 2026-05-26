Add-Type -AssemblyName PresentationFramework

# ── Confirmation avant tout ──────────────────────────────────
$confirm = [System.Windows.MessageBox]::Show(
    "Voulez-vous vraiment redémarrer le serveur ?`n`n" +
    "⚠️ Ceci redémarre uniquement le serveur de l'application des ventes,`n" +
    "pas l'application elle-même.`n`n" +
    "Les connexions en cours seront interrompues quelques secondes.",
    "Redémarrer le serveur ?",
    [System.Windows.MessageBoxButton]::YesNo,
    [System.Windows.MessageBoxImage]::Question
)

if ($confirm -ne [System.Windows.MessageBoxResult]::Yes) { exit }

# ── Redémarrage ──────────────────────────────────────────────
try {
    $task = Get-ScheduledTask -TaskName 'ShopApp' -ErrorAction SilentlyContinue
    if ($task) {
        if ($task.State -eq 'Running') {
            Stop-ScheduledTask -TaskName 'ShopApp' -ErrorAction SilentlyContinue
            Start-Sleep 2
        }
        Start-ScheduledTask -TaskName 'ShopApp'
        Start-Sleep 4
        [System.Windows.MessageBox]::Show(
            "✅ Le serveur redémarre.`n`nAttendez 10 secondes, puis cliquez sur`n🔄 Réessayer dans la page.",
            "Serveur redémarré",
            [System.Windows.MessageBoxButton]::OK,
            [System.Windows.MessageBoxImage]::Information
        ) | Out-Null
    } else {
        [System.Windows.MessageBox]::Show(
            "⚠️ Tâche planifiée ShopApp introuvable.`n`nRedémarrez le PC — le serveur`nse relancera automatiquement.",
            "Serveur introuvable",
            [System.Windows.MessageBoxButton]::OK,
            [System.Windows.MessageBoxImage]::Warning
        ) | Out-Null
    }
} catch {
    [System.Windows.MessageBox]::Show(
        "❌ Erreur : $_`n`nRedémarrez le PC ou contactez le support.",
        "Erreur serveur",
        [System.Windows.MessageBoxButton]::OK,
        [System.Windows.MessageBoxImage]::Error
    ) | Out-Null
}
