# Phan tich chunk JS trong .next/static/chunks: 6 chunk lon nhat, tong, va chunk nao chua dau hieu dang ngo.
# Dung: powershell -NoProfile -File phan-tich-chunk.ps1 [-DuAn <thu muc>] [-DauHieu "a","b"]
param(
    [string]$DuAn = (Get-Location).Path,
    [string[]]$DauHieu = @("Kiem soat phu tung", "Essential spare", "SheetJS", "XLSX", "pdfjs", "exceljs", "Manrope")
)
$thu = Join-Path $DuAn ".next\static\chunks"
if (-not (Test-Path $thu)) { Write-Host "Khong thay $thu - chua build?"; exit 1 }
$all = Get-ChildItem $thu -Filter "*.js" -Recurse
"=== 6 chunk lon nhat (chua nen; nen gzip ~ 1/3) ==="
$all | Sort-Object Length -Descending | Select-Object -First 6 | ForEach-Object { "  {0,-30} {1,9:N0} B" -f $_.Name, $_.Length }
"=== tong: {0} tep, {1:N0} B ===" -f $all.Count, ($all | Measure-Object Length -Sum).Sum
"=== chunk chua dau hieu (them dau hieu tieng Viet co dau bang -DauHieu neu can) ==="
foreach ($f in $all) {
    $c = [IO.File]::ReadAllText($f.FullName)
    $hit = @(); foreach ($d in $DauHieu) { if ($c.Contains($d)) { $hit += $d } }
    if ($hit.Count) { "  {0,-30} {1,9:N0} B  chua: {2}" -f $f.Name, $f.Length, ($hit -join ", ") }
}
