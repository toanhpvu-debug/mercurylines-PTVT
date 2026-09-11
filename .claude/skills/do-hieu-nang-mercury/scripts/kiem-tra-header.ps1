# Kiem tra header cache/preload cua trang va tep tinh. Khong can dang nhap.
# Dung: powershell -NoProfile -File kiem-tra-header.ps1 -Goc https://srv1964387.hstgr.cloud
param([string]$Goc = "http://localhost:3000")
function Hd($u) { (curl.exe -sS -o NUL -D - --compressed "$Goc$u" 2>$null) -join "`n" }
function Lay($hd, $ten) { $m = [regex]::Match($hd, "(?im)^$ten\s*:\s*(.+)$"); if ($m.Success) { $m.Groups[1].Value.Trim() } else { "(khong co)" } }
$h = (curl.exe -sS --compressed "$Goc/login" 2>$null) -join "`n"
$css = [regex]::Match($h, '/_next/static/[^"]+\.css').Value
$js = [regex]::Match($h, '/_next/static/chunks/[^"]+\.js').Value
"=== $Goc ==="
foreach ($u in @($css, $js, "/fonts/manrope-vietnamese.woff2", "/fonts/manrope-latin.woff2", "/motif-ring.svg", "/favicon.svg")) {
    if (-not $u) { continue }
    $hd = Hd $u
    "{0,-48} {1,-8} cache: {2}" -f $u, ([regex]::Match($hd, 'HTTP/\S+ (\d{3})').Groups[1].Value), (Lay $hd "cache-control")
}
$hl = Hd "/login"
"/login  status: " + ([regex]::Match($hl, 'HTTP/\S+ (\d{3})').Groups[1].Value)
"  Link (preload phong): " + $(if ((Lay $hl "link") -match "manrope") { "co" } else { "KHONG CO" })
"  X-Powered-By: " + (Lay $hl "x-powered-by") + "  (mong: khong co)"
"  Cache-Control: " + (Lay $hl "cache-control")
"=== TTFB /login x3 (gom TLS) ==="
1..3 | ForEach-Object { curl.exe -sS -o NUL -w "  ttfb=%{time_starttransfer}s total=%{time_total}s`n" --compressed "$Goc/login" 2>$null }
