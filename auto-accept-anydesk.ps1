Add-Type @"
using System;
using System.Runtime.InteropServices;
public class AD {
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, int e);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWinProc p, IntPtr l);
    [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumWinProc p, IntPtr l);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int m);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr wp, IntPtr lp);
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr wp, IntPtr lp);
    public delegate bool EnumWinProc(IntPtr h, IntPtr l);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
    public const uint DOWN   = 0x0002;
    public const uint UP     = 0x0004;
    public const uint BM_CLICK = 0x00F5;
}
"@

$log = "C:\apps\shop-app\auto-accept.log"
"[$([datetime]::Now)] daemon started v2" | Out-File $log -Append

$seen = @{}

function Click($x, $y) {
    [AD]::SetCursorPos($x, $y) | Out-Null
    Start-Sleep -Milliseconds 100
    [AD]::mouse_event([AD]::DOWN, 0,0,0,0)
    Start-Sleep -Milliseconds 80
    [AD]::mouse_event([AD]::UP, 0,0,0,0)
    Start-Sleep -Milliseconds 150
}

function TryAccept($hwnd, $L, $T, $W, $H) {
    # 1. Chercher le bouton Accept parmi les enfants (au cas ou wxWidgets l'expose)
    $childBtn = [IntPtr]::Zero
    [AD]::EnumChildWindows($hwnd, {
        param($h, $l)
        $sb = New-Object System.Text.StringBuilder 256
        [AD]::GetWindowText($h, $sb, 256) | Out-Null
        $t = $sb.ToString()
        if ($t -match "Accept|Accepter|Allow|Autoriser") {
            $script:childBtn = $h
            return $false
        }
        return $true
    }, [IntPtr]::Zero) | Out-Null

    if ($childBtn -ne [IntPtr]::Zero) {
        $sb2 = New-Object System.Text.StringBuilder 256
        [AD]::GetWindowText($childBtn, $sb2, 256) | Out-Null
        "  -> BM_CLICK sur '$($sb2)'" | Add-Content $log
        [AD]::SendMessage($childBtn, [AD]::BM_CLICK, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
        Start-Sleep -Milliseconds 500
        return
    }

    # 2. Accept est a GAUCHE dans AnyDesk (Refuser est a droite — confirme)
    # y entre 88% et 97% (boutons tout en bas du dialogue)
    # NE PAS cliquer cote droit (c'est Refuser)
    [AD]::SetForegroundWindow($hwnd) | Out-Null
    Start-Sleep -Milliseconds 500

    foreach ($yp in @(0.88, 0.91, 0.94, 0.97)) {
        foreach ($xp in @(0.12, 0.18, 0.22, 0.28, 0.33)) {
            $px = [int]($L + $W * $xp)
            $py = [int]($T + $H * $yp)
            "  Click GAUCHE x=$px y=$py (${xp}x${yp})" | Add-Content $log
            Click $px $py
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
                # Taille dialogue demande de connexion : pas trop grand, pas trop petit
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
        $cutoff = (Get-Date).AddSeconds(-60)
        ($seen.Keys | Where-Object { $seen[$_] -lt $cutoff }) | ForEach-Object { $seen.Remove($_) }
    } catch {
        "[$([datetime]::Now)] ERR: $_" | Add-Content $log
    }
}
