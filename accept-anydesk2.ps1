Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic

# Lister toutes les fenêtres AnyDesk et leurs contrôles
$root = [System.Windows.Automation.AutomationElement]::RootElement
$cond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ClassNameProperty, "wxWindowNR")
$wins = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $cond)

$logFile = "C:\apps\shop-app\anydesk-ui.log"
"Windows found: $($wins.Count)" | Out-File $logFile

foreach ($win in $wins) {
    $name = $win.Current.Name
    "Window: $name" | Add-Content $logFile
    # Chercher tous les boutons dans cette fenêtre
    $btnCond = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Button)
    $btns = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
    foreach ($btn in $btns) {
        $btnName = $btn.Current.Name
        "  Button: $btnName" | Add-Content $logFile
        # Cliquer si c'est Accepter/Accept/OK
        if ($btnName -match "Accept|OK|Autoriser|Allow") {
            "  -> CLIC sur $btnName" | Add-Content $logFile
            $invokePattern = $btn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
            $invokePattern.Invoke()
        }
    }
}

# Fallback: chercher toutes fenêtres avec Any dans le titre
$allWins = $root.FindAll([System.Windows.Automation.TreeScope]::Children,
    [System.Windows.Automation.Condition]::TrueCondition)
foreach ($win in $allWins) {
    $name = $win.Current.Name
    if ($name -match "AnyDesk|any") {
        "AnyDesk Window: '$name'" | Add-Content $logFile
        $btnCond = New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::Button)
        $btns = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
        foreach ($btn in $btns) {
            "  Btn: '$($btn.Current.Name)'" | Add-Content $logFile
        }
    }
}
"Done" | Add-Content $logFile
