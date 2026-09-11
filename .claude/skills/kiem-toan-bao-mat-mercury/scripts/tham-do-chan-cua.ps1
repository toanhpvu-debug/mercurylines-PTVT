# Tham do chan cua khi CHUA dang nhap: trang -> 307 ve /login, API -> 401/307, tep tinh -> 200.
# Dung: powershell -NoProfile -File tham-do-chan-cua.ps1 -Goc https://srv1964387.hstgr.cloud
param([string]$Goc = "http://localhost:3000")
$trang = @("/dashboard","/vessels","/vessels/1","/materials","/materials/import","/inventory","/inventory/stock-card?material=1&wh=1",
           "/requests","/requests/1","/purchasing","/purchasing/new","/purchasing/direct","/purchasing/forms","/purchasing/suppliers",
           "/paint","/paint/1","/paint/products","/paint/import","/consumables","/consumables/1","/consumables/products",
           "/lashing","/lashing/1","/reports","/documents","/users","/audit")
$api = @("/api/export/inventory","/api/material-requests","/api/materials/template","/api/documents/1","/api/consumable-receipts/1/file")
$tinh = @("/login","/fonts/manrope-vietnamese.woff2","/fonts/michroma-latin.woff2","/motif-ring.svg","/favicon.svg")
$loi = 0
function Ma($u) { curl.exe -sS -o NUL -w "%{http_code}" "$Goc$u" 2>$null }
"=== $Goc ==="
foreach ($u in $trang) { $m = Ma $u; $ok = ($m -eq "307"); if (-not $ok) { $loi++ }; "  {0,-46} {1}  {2}" -f $u, $m, $(if ($ok) { "" } else { "<-- MONG 307" }) }
foreach ($u in $api)   { $m = Ma $u; $ok = ($m -in "401","307","405"); if (-not $ok) { $loi++ }; "  {0,-46} {1}  {2}" -f $u, $m, $(if ($ok) { "" } else { "<-- MONG 401/307" }) }
foreach ($u in $tinh)  { $m = Ma $u; $ok = ($m -eq "200"); if (-not $ok) { $loi++ }; "  {0,-46} {1}  {2}" -f $u, $m, $(if ($ok) { "" } else { "<-- MONG 200" }) }
"=== lech: $loi ==="
exit $(if ($loi -eq 0) { 0 } else { 1 })
