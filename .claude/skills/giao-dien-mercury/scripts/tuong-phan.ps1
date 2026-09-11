# Tinh ty le tuong phan WCAG 2 cua cac bien chu trong app/globals.css, ca hai che do.
# Dung: powershell -NoProfile -File tuong-phan.ps1 [-DuAn <thu muc>]
param([string]$DuAn = (Get-Location).Path)
$css = [IO.File]::ReadAllText((Join-Path $DuAn "app\globals.css"))
function Lum($hex) { $h = $hex.TrimStart('#'); $c = @(); foreach ($i in 0,2,4) { $v = [Convert]::ToInt32($h.Substring($i,2),16) / 255.0; $c += $(if ($v -le 0.03928) { $v/12.92 } else { [Math]::Pow(($v+0.055)/1.055, 2.4) }) }; return 0.2126*$c[0] + 0.7152*$c[1] + 0.0722*$c[2] }
function CR($a, $b) { $l1 = Lum $a; $l2 = Lum $b; if ($l1 -lt $l2) { $t=$l1; $l1=$l2; $l2=$t }; return [Math]::Round(($l1+0.05)/($l2+0.05), 2) }
function Mix($hex, $toward, $k) { $h = $hex.TrimStart('#'); $t = $toward.TrimStart('#'); $out = ""; foreach ($i in 0,2,4) { $a = [Convert]::ToInt32($h.Substring($i,2),16); $b = [Convert]::ToInt32($t.Substring($i,2),16); $v = [int][Math]::Round($a + ($b - $a) * $k); $out += ("{0:x2}" -f [Math]::Max(0, [Math]::Min(255, $v))) }; return "#$out" }
# Fit: giu sac, keo do sang ve $toward tung buoc 1% toi khi dat $target tren moi nen trong $bgs.
function Fit($hex, $bgs, $target, $toward) { for ($k = 0.0; $k -le 1.0; $k += 0.01) { $c = Mix $hex $toward $k; $ok = $true; foreach ($bg in $bgs) { if ((CR $c $bg) -lt $target) { $ok = $false; break } }; if ($ok) { return $c } }; return $toward }
function Tokens($block) { $m = @{}; foreach ($x in [regex]::Matches($block, '--([a-z-]+):\s*(#[0-9a-fA-F]{6})')) { $m[$x.Groups[1].Value] = $x.Groups[2].Value }; return $m }
$iRoot = $css.IndexOf(":root {"); $iDark = $css.IndexOf(":root.dark {", $iRoot)
$light = Tokens ($css.Substring($iRoot, $iDark - $iRoot)); $dark = Tokens ($css.Substring($iDark, [Math]::Min(3000, $css.Length - $iDark)))
$nguong = @{ "text-secondary" = 7.5; "text-muted" = 7.0; "text-success" = 6.5; "text-warning" = 6.5; "text-danger" = 6.5; "text-info" = 6.5 }
foreach ($theme in @(@{n="SANG"; t=$light; mutedMin=6.2}, @{n="TOI"; t=$dark; mutedMin=7.0})) {
    $T = $theme.t
    "=== $($theme.n): chu / nen (AA thuong >= 4.5; nguong du an trong ngoac) ==="
    foreach ($txt in @("text-primary","text-secondary","text-muted","text-success","text-warning","text-danger","text-info")) {
        $min = if ($txt -eq "text-muted") { $theme.mutedMin } elseif ($nguong.ContainsKey($txt)) { $nguong[$txt] } else { 7.0 }
        $row = "{0,-16} (>= {1,4})" -f $txt, $min; $xau = $false
        foreach ($bg in @("surface","surface-raised","surface-sunken")) { $r = CR $T[$txt] $T[$bg]; if ($r -lt $min) { $xau = $true }; $row += "  {0}={1,5}" -f $bg.Replace("surface-",""), $r }
        $row + $(if ($xau) { "   <-- DUOI NGUONG" } else { "" })
    }
    "--- nhan trang thai: tone-*-text tren tone-*-bg (>= 6.0) ---"
    foreach ($tone in @("neutral","brand","success","warning","danger","info","muted")) { $r = CR $T["tone-$tone-text"] $T["tone-$tone-bg"]; "{0,-10} {1,5}  ({2} / {3}){4}" -f $tone, $r, $T["tone-$tone-text"], $T["tone-$tone-bg"], $(if ($r -lt 6.0) { "  <-- DUOI NGUONG" } else { "" }) }
}
"Goi y mau moi dat nguong: dot-source file nay roi goi  Fit '#8591a5' @('#0b1117','#141e30','#060a13') 7.0 '#ffffff'"
