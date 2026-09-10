# Dọn rác của bản cài trên máy này — CHỈ cache, log cũ, tệp tạm. Không đụng dữ
# liệu (pgdata, uploads, .env), không đụng node_modules hay bản build đang chạy.
#
#   don-dep.cmd                 dọn cache npm, log đời trước, tệp tạm; liệt kê thứ to nhưng không tự xóa
#   don-dep.cmd -CaCacheBuild   thêm: xóa .next\cache (lần chạy sau build lâu hơn ~20 giây)
#
# Đo lần đầu (10/09/2026) trên máy văn phòng: cache npm 3,2 GB là thứ to nhất và
# vô hại khi xóa — nó chỉ là bản tải sẵn của các gói, cài lại thì tải lại. Thứ
# to thứ hai là pgAdmin 4 (673 MB) đi kèm bản PostgreSQL xách tay, app không
# dùng — nhưng đó là một chương trình, không phải rác, nên chỉ liệt kê kèm lệnh
# xóa để người dùng tự quyết.

param([switch]$CaCacheBuild)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

$proj = Split-Path -Parent $PSScriptRoot
$goc = Split-Path -Parent $proj

function MB($p) {
    if (-not (Test-Path $p)) { return 0 }
    $it = Get-Item $p -Force
    $s = if ($it.PSIsContainer) {
        (Get-ChildItem $p -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    } else { $it.Length }
    if (-not $s) { $s = 0 }
    return [math]::Round($s / 1MB, 1)
}

$script:tong = 0
function Xoa($p, $ly) {
    if (-not (Test-Path $p)) { return }
    $mb = MB $p
    Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $p) {
        Write-Host ("  ! {0,-50} không xóa được (đang dùng?)" -f $p.Replace($goc + '\', '')) -ForegroundColor Yellow
        return
    }
    $script:tong += $mb
    Write-Host ("  - {0,-50} {1,8:N1} MB  ({2})" -f $p.Replace($goc + '\', ''), $mb, $ly)
}

Write-Host ""
Write-Host "=== DỌN RÁC MERCURY MATERIALS ===" -ForegroundColor Cyan
Write-Host ""

# 1. Cache npm (_cacache). KHÔNG đụng _npx: các công cụ chạy bằng npx đang mở
#    có thể đang chạy từ chính thư mục đó.
$npmCache = Join-Path $env:LOCALAPPDATA "npm-cache\_cacache"
$mbNpm = MB $npmCache
if ($mbNpm -gt 0) {
    $npm = if ($env:NODE_EXE) { Join-Path (Split-Path -Parent $env:NODE_EXE) "npm.cmd" } else { "npm" }
    & $npm cache clean --force 2>$null | Out-Null
    $giam = $mbNpm - (MB $npmCache)
    $script:tong += $giam
    Write-Host ("  - {0,-50} {1,8:N1} MB  (cache npm — cài gói lần sau sẽ tải lại)" -f "npm-cache\_cacache", $giam)
}

# 2. Log đời trước và tệp tạm
Xoa (Join-Path $goc "app-logs\app.log.cu") "log đời trước"
Get-ChildItem (Join-Path $proj "uploads\tam-doc") -File -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-1) } |
    ForEach-Object { Xoa $_.FullName "tệp tạm OCR quá 1 ngày" }
Get-ChildItem $env:TEMP -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "mercury-*" -or $_.Name -like "pg_ctl-*" } |
    ForEach-Object { Xoa $_.FullName "tệp tạm" }

# 3. Cache build — chỉ khi được yêu cầu, vì nó làm lần build sau nhanh hơn.
if ($CaCacheBuild) {
    Xoa (Join-Path $proj ".next\cache") "cache build — lần chạy sau build lâu hơn"
}

Write-Host ""
Write-Host ("Đã giải phóng {0:N1} MB." -f $script:tong) -ForegroundColor Green

# 4. Thứ to trên đĩa nhưng KHÔNG tự xóa — quyết định là của người dùng.
Write-Host ""
Write-Host "Thứ to trên đĩa, không tự xóa:" -ForegroundColor Cyan
$pgAdmin = Join-Path $goc "pgsql\pgAdmin 4"
if (Test-Path $pgAdmin) {
    Write-Host ("  {0,-22} {1,8:N1} MB  giao diện quản trị đi kèm PostgreSQL, app không dùng." -f "pgsql\pgAdmin 4", (MB $pgAdmin))
    Write-Host ("  {0,-22} {1,11}  Xóa: Remove-Item -Recurse -Force ""{2}""" -f "", "", $pgAdmin) -ForegroundColor DarkGray
}
Get-ChildItem "$goc\*" -Include *.rar, *.zip, *.7z -File -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host ("  {0,-22} {1,8:N1} MB  tệp nén cũ ({2:dd/MM/yyyy}). Mã nguồn đã ở GitHub, dữ liệu do sao-luu-du-lieu.cmd giữ." -f $_.Name, ($_.Length / 1MB), $_.LastWriteTime)
}
if (-not $CaCacheBuild) {
    Write-Host ("  {0,-22} {1,8:N1} MB  cache build, giữ để build nhanh. Xóa: don-dep.cmd -CaCacheBuild" -f ".next\cache", (MB (Join-Path $proj ".next\cache")))
}
Write-Host ""
