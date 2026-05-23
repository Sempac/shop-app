Add-Type @"
using System;
using System.Runtime.InteropServices;
public class AD {
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, int e);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWinProc p, IntPtr l);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int m);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr wp, IntPtr lp);
    public delegate bool EnumWinProc(IntPtr h, IntPtr l);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
    public const uint DOWN = 0x0002;
    public const uint UP   = 0x0004;
}
"@
Add-Type -AssemblyName System.Windows.Forms

$log = "C:\apps\shop-app\auto-accept.log"
"[$([datetime]::Now)] daemon started" | Out-File $log -Append

$seen = @{}

function Click($x, $y) {
    [AD]::SetCursorPos($x, $y) | Out-Null
    Start-Sleep -Milliseconds 100
    [AD]::mouse_event([AD]::DOWN, 0,0,0,0)
    Start-Sleep -Milliseconds 80
    [AD]::mouse_event([AD]::UP, 0,0,0,0)
    Start-Sleep -Milliseconds 120
}

function TryAccept($hwnd, $L, $T, $W, $H) {
    # 1. PostMessage Enter directement au handle
    [AD]::PostMessage($hwnd, 0x0100, [IntPtr]0x0D, [IntPtr]0x000F0001) | Out-Null
    Start-Sleep -Milliseconds 300
    [AD]::PostMessage($hwnd, 0x0101, [IntPtr]0x0D, [IntPtr]0xC00F0001) | Out-Null
    Start-Sleep -Milliseconds 400

    # 2. SetForeground + SendKeys
    [AD]::SetForegroundWindow($hwnd) | Out-Null
    Start-Sleep -Milliseconds 600
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 400
    [System.Windows.Forms.SendKeys]::SendWait(" ")
    Start-Sleep -Milliseconds 300

    # 3. Clic cote DROIT (Accept est a droite dans AnyDesk 7/8)
    # y entre 88% et 96% (boutons tout en bas)
    [AD]::SetForegroundWindow($hwnd) | Out-Null
    Start-Sleep -Milliseconds 400
    foreach ($yp in @(0.88, 0.91, 0.94, 0.96)) {
        foreach ($xp in @(0.60, 0.65, 0.70, 0.75, 0.78)) {
            Click ([int]($L + $W * $xp)) ([int]($T + $H * $yp))
        }
    }

    # 4. Cote GAUCHE aussi (quelques versions ont Accept a gauche)
    [AD]::SetForegroundWindow($hwnd) | Out-Null
    Start-Sleep -Milliseconds 200
    foreach ($yp in @(0.88, 0.92, 0.95)) {
        foreach ($xp in @(0.15, 0.22, 0.28, 0.35)) {
            Click ([int]($L + $W * $xp)) ([int]($T + $H * $yp))
        }
    }
}

while ($true) {
    Start-Sleep -Seconds 2
    try {
        $dialogs = [System.Collections.Generic.List[IntPtr]]::new()
        [AD]::EnumWindows({
            param($h, $l)
            if (-not [AD]::IsWindowVisible($h)) { return $true }
            $sb = New-Object System.Text.StringBuilder 512
            [AD]::GetWindowText($h, $sb, 512) | Out-Null
            $t = $sb.ToString()
            if ($t -match "AnyDesk") {
                $r = New-Object AD+RECT
                [AD]::GetWindowRect($h, [ref]$r) | Out-Null
                $w = $r.R - $r.L; $ht = $r.B - $r.T
                if ($w -gt 200 -and $w -lt 950 -and $ht -gt 150 -and $ht -lt 750) {
                    $script:dialogs.Add($h) | Out-Null
                }
            }
            return $true
        }, [IntPtr]::Zero) | Out-Null

        foreach ($dlg in $dialogs) {
            $r = New-Object AD+RECT
            [AD]::GetWindowRect($dlg, [ref]$r) | Out-Null
            $W = $r.R-$r.L; $H = $r.B-$r.T
            $key = "$dlg"
            if (-not $seen.ContainsKey($key)) {
                $seen[$key] = (Get-Date)
                $sb = New-Object System.Text.StringBuilder 512
                [AD]::GetWindowText($dlg, $sb, 512) | Out-Null
                "[$([datetime]::Now)] Found: '$($sb)' W=$W H=$H handle=$dlg" | Add-Content $log
                TryAccept $dlg $r.L $r.T $W $H
                "[$([datetime]::Now)] Attempts done" | Add-Content $log
            }
        }
        # Nettoyer seen (>60s)
        $cutoff = (Get-Date).AddSeconds(-60)
        ($seen.Keys | Where-Object { $seen[$_] -lt $cutoff }) | ForEach-Object { $seen.Remove($_) }
    } catch {
        "[$([datetime]::Now)] ERR: $_" | Add-Content $log
    }
}
