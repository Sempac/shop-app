Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class DisplayHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public struct DEVMODE {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;
        public short dmSpecVersion, dmDriverVersion, dmSize, dmDriverExtra;
        public int dmFields, dmPositionX, dmPositionY, dmDisplayOrientation, dmDisplayFixedOutput;
        public short dmColor, dmDuplex, dmYResolution, dmTTOption, dmCollate;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;
        public short dmLogPixels;
        public int dmBitsPerPel, dmPelsWidth, dmPelsHeight, dmDisplayFlags, dmDisplayFrequency;
        public int dmICMMethod, dmICMIntent, dmMediaType, dmDitherType;
        public int dmReserved1, dmReserved2, dmPanningWidth, dmPanningHeight;
    }
    [DllImport("user32.dll")] public static extern bool EnumDisplaySettings(string d, int n, ref DEVMODE m);
    [DllImport("user32.dll")] public static extern int  ChangeDisplaySettings(ref DEVMODE m, int f);
}
"@

$dm = New-Object DisplayHelper+DEVMODE
$dm.dmSize = [System.Runtime.InteropServices.Marshal]::SizeOf($dm)
[DisplayHelper]::EnumDisplaySettings($null, -1, [ref]$dm) | Out-Null

$before = "$($dm.dmPelsWidth)x$($dm.dmPelsHeight)"

# Passer a 1024x768 — texte encore plus grand
$dm.dmPelsWidth  = 1024
$dm.dmPelsHeight = 768
$dm.dmFields     = 0x180000   # DM_PELSWIDTH | DM_PELSHEIGHT

$result = [DisplayHelper]::ChangeDisplaySettings([ref]$dm, 0)
# 0 = DISP_CHANGE_SUCCESSFUL

"Resolution avant : $before"  | Out-Host
"ChangeDisplaySettings result : $result (0=OK)" | Out-Host
