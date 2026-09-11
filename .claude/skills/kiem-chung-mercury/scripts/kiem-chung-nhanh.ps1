# tsc -> eslint -> 6 bo kiem thu. Dung o buoc dau tien truot. Khong dung database.
# Dung: powershell -NoProfile -File kiem-chung-nhanh.ps1 [-DuAn <thu muc du an>]
param([string]$DuAn = (Get-Location).Path)
Set-Location $DuAn
[Console]::OutputEncoding = [Text.Encoding]::UTF8
"=== tsc ==="
& ".\node_modules\.bin\tsc.cmd" --noEmit -p tsconfig.json 2>&1 | Select-Object -Last 12 | ForEach-Object { "  $_" }
if ($LASTEXITCODE -ne 0) { "tsc TRUOT"; exit 1 }; "  tsc 0"
"=== eslint ==="
& ".\node_modules\.bin\eslint.cmd" "app" "components" "lib" "scripts" "proxy.ts" "next.config.ts" 2>&1 | Select-Object -Last 20 | ForEach-Object { "  $_" }
if ($LASTEXITCODE -ne 0) { "eslint TRUOT"; exit 1 }; "  eslint 0"
"=== kiem thu ==="
$bo = @("kiem-tra-ngon-ngu","kiem-tra-ma-vat-tu","kiem-tra-phan-quyen","kiem-tra-mau-danh-muc","kiem-tra-dong-bo","kiem-tra-doc-phieu")
foreach ($s in $bo) {
    $o = & node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs "scripts/$s.ts" 2>&1 | ForEach-Object { "$_" }
    $ma = $LASTEXITCODE
    "  {0,-24} exit={1}  {2}" -f $s, $ma, ($o | Where-Object { $_ -match "TONG" } | Select-Object -Last 1)
    if ($ma -ne 0) { $o | Select-Object -Last 12 | ForEach-Object { "      $_" }; "$s TRUOT"; exit 1 }
}
"=== XANH (may): tsc 0, eslint 0, 6 bo kiem thu dat. Con build + smoke: build-lai.ps1 ==="
