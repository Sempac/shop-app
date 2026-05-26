Add-Type -AssemblyName PresentationFramework
try {
    $task = Get-ScheduledTask -TaskName 'ShopApp' -ErrorAction SilentlyContinue
    if ($task) {
        if ($task.State -eq 'Running') { Stop-ScheduledTask -TaskName 'ShopApp' -ErrorAction SilentlyContinue; Start-Sleep 2 }
        Start-ScheduledTask -TaskName 'ShopApp'
        Start-Sleep 4
        [System.Windows.MessageBox]::Show(
            "✅ L'application des ventes redémarre.`n`nAttendez 10 secondes, puis cliquez sur`n🔄 Réessayer dans la page d'erreur.",
            "Redémarrage - Application des Ventes",
            [System.Windows.MessageBoxButton]::OK,
            [System.Windows.MessageBoxImage]::Information
        ) | Out-Null
    } else {
        [System.Windows.MessageBox]::Show(
            "⚠️ Tâche ShopApp introuvable sur ce PC.`n`nRedémarrez le PC — l'application`nse relancera automatiquement.",
            "Application des Ventes",
            [System.Windows.MessageBoxButton]::OK,
            [System.Windows.MessageBoxImage]::Warning
        ) | Out-Null
    }
} catch {
    [System.Windows.MessageBox]::Show(
        "❌ Erreur : $_`n`nRedémarrez le PC ou contactez le support.",
        "Erreur",
        [System.Windows.MessageBoxButton]::OK,
        [System.Windows.MessageBoxImage]::Error
    ) | Out-Null
}
