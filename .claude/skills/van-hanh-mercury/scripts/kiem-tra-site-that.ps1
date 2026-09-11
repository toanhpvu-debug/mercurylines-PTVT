# Xac minh site that sau deploy. Khong can dang nhap. Tra exit 1 neu co muc lech.
# Dung: powershell -NoProfile -File kiem-tra-site-that.ps1 [-Goc <goc>]
#   Mac dinh: site that, dia chi doc tu dong "site=" trong ..\dia-chi-may-chu.local.md
#   (tep cuc bo NGOAI repo vi repo cong khai). -Goc http://localhost:3000 cho ban cuc bo.
param([string]$Goc = "")
if (-not $Goc) {
    $tepDiaChi = Join-Path $PSScriptRoot "..\..\..\..\..\dia-chi-may-chu.local.md"
    if (Test-Path $tepDiaChi) {
        $dong = Get-Content $tepDiaChi | Where-Object { $_ -like 'site=*' } | Select-Object -First 1
        if ($dong) { $Goc = $dong.Substring(5).Trim() }
    }
    if (-not $Goc) { $Goc = "http://localhost:3000" }
}
$script:lech = 0
function Ma($u) { curl.exe -sS -o NUL -w "%{http_code}" "$Goc$u" 2>$null }
function Hd($u) { (curl.exe -sS -o NUL -D - --compressed "$Goc$u" 2>$null) -join "`n" }
function Kiem($ten, $dung) { if ($dung) { "  [ok ] $ten" } else { $script:lech++; "  [LECH] $ten" } }
"=== $Goc ==="
$h = (curl.exe -sS --compressed "$Goc/login" 2>$null) -join "`n"
Kiem "/login 200" ((Ma "/login") -eq "200")
Kiem "nen toi mac dinh (class=dark)" ($h -match '<html[^>]*class="dark"')
Kiem "logo SVG" ($h.Contains('viewBox="0 0 140 23"'))
Kiem "/dashboard chan cua 307" ((Ma "/dashboard") -eq "307")
Kiem "/api/export/inventory chan cua 401/307" ((Ma "/api/export/inventory") -in "401","307")
$hf = Hd "/fonts/manrope-vietnamese.woff2"
Kiem "phong 200 + immutable" (($hf -match 'HTTP/\S+ 200') -and ($hf -match '(?i)cache-control:.*immutable'))
$hl = Hd "/login"
Kiem "header Link preload phong" ($hl -match '(?im)^link:.*manrope')
Kiem "khong X-Powered-By" (-not ($hl -match '(?im)^x-powered-by:'))
Kiem "/next.svg da xoa -> 404" ((Ma "/next.svg") -eq "404")
"=== lech: $($script:lech) ==="
exit $(if ($script:lech -eq 0) { 0 } else { 1 })
