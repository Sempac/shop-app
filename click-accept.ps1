Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinAPI {
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, int e);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWinProc p, IntPtr l);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int m);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    public delegate bool EnumWinProc(IntPtr h, IntPtr l);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
    public const uint DOWN = 0x0002;
    public const uint UP   = 0x0004;
}
"@

function Click($x, $y) {
    [WinAPI]::SetCursorPos($x, $y) | Out-Null
    Start-Sleep -Milliseconds 150
    [WinAPI]::mouse_event([WinAPI]::DOWN, 0,0,0,0)
    Start-Sleep -Milliseconds 80
    [WinAPI]::mouse_event([WinAPI]::UP, 0,0,0,0)
    Start-Sleep -Milliseconds 200
}

$log = "C:\apps\shop-app\click-accept.log"
"Start $(Get-Date)" | Out-File $log

$wins = @()
[WinAPI]::EnumWindows({
    param($h,$l)
    $sb = New-Object System.Text.StringBuilder 256
    [WinAPI]::GetWindowText($h,$sb,256)|Out-Null
    if ($sb.ToString() -match "AnyDesk" -and [WinAPI]::IsWindowVisible($h)) {
        $script:wins += $h
    }
    return $true
}, [IntPtr]::Zero) | Out-Null

# Chercher la plus petite fenêtre = popup d'acceptation
$dialog = $wins | Sort-Object {
    $r = New-Object WinAPI+RECT
    [WinAPI]::GetWindowRect($_, [ref]$r) | Out-Null
    ($r.R-$r.L) * ($r.B-$r.T)
} | Select-Object -First 1

$rect = New-Object WinAPI+RECT
[WinAPI]::GetWindowRect($dialog, [ref]$rect) | Out-Null
$L=$rect.L; $T=$rect.T; $W=$rect.R-$rect.L; $H=$rect.B-$rect.T
"Dialog: L=$L T=$T W=$W H=$H" | Add-Content $log

[WinAPI]::SetForegroundWindow($dialog) | Out-Null
Start-Sleep -Milliseconds 600

# Accepter est toujours à GAUCHE dans AnyDesk — essayer plusieurs positions bas de fenêtre
$positions = @(
    @{x=[int]($L+$W*0.22); y=[int]($T+$H*0.83)},  # bas gauche
    @{x=[int]($L+$W*0.28); y=[int]($T+$H*0.87)},  # bas gauche 2
    @{x=[int]($L+$W*0.22); y=[int]($T+$H*0.90)},  # bas gauche 3
    @{x=[int]($L+$W*0.35); y=[int]($T+$H*0.85)}   # bas centre-gauche
)

foreach ($p in $positions) {
    "Click at X=$($p.x) Y=$($p.y)" | Add-Content $log
    Click $p.x $p.y
    Start-Sleep -Milliseconds 300
}
"End" | Add-Content $log
