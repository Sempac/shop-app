Add-Type -AssemblyName Microsoft.VisualBasic
Add-Type -AssemblyName System.Windows.Forms
Start-Sleep -Milliseconds 500
[Microsoft.VisualBasic.Interaction]::AppActivate('AnyDesk')
Start-Sleep -Milliseconds 1000
# Essayer Enter (bouton Accepter par défaut)
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Milliseconds 300
# Aussi Tab+Enter au cas où
[System.Windows.Forms.SendKeys]::SendWait('{TAB}{ENTER}')
