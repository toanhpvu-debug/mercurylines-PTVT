# Sao lưu dữ liệu vận hành của Mercury Materials.
#
# Sao lưu đúng những thứ KHÔNG nằm trên GitHub (vì chúng là dữ liệu, không phải mã nguồn):
#   - database\mercury.dump  bản chụp PostgreSQL: tồn kho, yêu cầu, đơn mua, tài khoản...
#   - uploads\               file báo cáo tàu đã tải lên
#   - .env                   khóa session + thông tin công ty in trên chứng từ
#   - templates\*.xlsx       biểu mẫu Excel gốc của công ty
#
# Kết quả: E:\backup-mercury\backup-YYYYMMDD-HHmm.zip

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$proj = Split-Path -Parent $PSScriptRoot
$backupRoot = "E:\backup-mercury"
$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$zipPath = Join-Path $backupRoot "backup-$stamp.zip"

Write-Host ""
Write-Host "=== SAO LƯU DỮ LIỆU MERCURY MATERIALS ===" -ForegroundColor Cyan
Write-Host "Dự án : $proj"
Write-Host "Lưu về: $zipPath"
Write-Host ""

# Cảnh báo nếu app đang chạy — nên tắt để database chắc chắn ở trạng thái ổn định.
$running = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "! App đang chạy ở cổng 3000." -ForegroundColor Yellow
    Write-Host "  Script vẫn sao lưu an toàn được, nhưng nếu vừa nhập liệu xong thì nên tắt app rồi chạy lại cho chắc." -ForegroundColor Yellow
    Write-Host ""
}

# Gom dữ liệu vào thư mục tạm rồi mới nén, để giữ đúng cấu trúc thư mục trong file zip.
$staging = Join-Path $env:TEMP "mercury-backup-$stamp"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging -Force | Out-Null

$found = @()

# --- 1. Database (PostgreSQL) ---
# Đọc DATABASE_URL trong .env rồi gọi pg_dump. Trước đây script chép file
# prisma\dev.db; sau khi chuyển sang PostgreSQL thì file đó chỉ còn là bản
# SQLite cũ đóng băng — sao lưu nó là sao lưu nhầm, dữ liệu thật vẫn nằm trong
# PostgreSQL.
$envFile = Join-Path $proj ".env"
$dbUrl = $null
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*DATABASE_URL\s*=\s*"?([^"]+)"?\s*$') { $dbUrl = $Matches[1]; break }
    }
}

if (-not $dbUrl) {
    throw "Không đọc được DATABASE_URL trong $envFile — không biết sao lưu database nào."
}

# postgresql://user:pass@host:port/db?schema=public
if ($dbUrl -notmatch '^postgres(ql)?://([^:]+):([^@]*)@([^:/]+):(\d+)/([^?]+)') {
    throw "DATABASE_URL không phải chuỗi kết nối PostgreSQL hợp lệ: $dbUrl"
}
$pgUser = $Matches[2]
$pgPass = [System.Uri]::UnescapeDataString($Matches[3])
$pgHost = $Matches[4]
$pgPort = $Matches[5]
$pgName = $Matches[6]

# Tìm pg_dump: ưu tiên trong PATH, không có thì dò thư mục cài PostgreSQL.
$pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source
if (-not $pgDump) {
    $cand = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending |
            ForEach-Object { Join-Path $_.FullName "bin\pg_dump.exe" } |
            Where-Object { Test-Path $_ } |
            Select-Object -First 1
    $pgDump = $cand
}
if (-not $pgDump) {
    throw "Không tìm thấy pg_dump.exe. Cài PostgreSQL client hoặc thêm thư mục bin vào PATH."
}

New-Item -ItemType Directory -Path (Join-Path $staging "database") -Force | Out-Null
$dumpOut = Join-Path $staging "database\mercury.dump"

# Định dạng custom (-Fc): nén sẵn, khôi phục bằng pg_restore, chọn được từng bảng.
$env:PGPASSWORD = $pgPass
try {
    & $pgDump -h $pgHost -p $pgPort -U $pgUser -d $pgName -Fc -f $dumpOut
    if ($LASTEXITCODE -ne 0) { throw "pg_dump trả về mã lỗi $LASTEXITCODE" }
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
$found += "database\mercury.dump  ({0:N0} KB)" -f ((Get-Item $dumpOut).Length / 1KB)

# Kèm luôn lệnh khôi phục — lúc cần dùng bản sao lưu thường là lúc hoảng.
$huongDan = @"
KHÔI PHỤC DỮ LIỆU MERCURY MATERIALS
===================================

File mercury.dump là bản chụp toàn bộ database PostgreSQL (định dạng custom).

1. Tạo database rỗng (nếu chưa có):
     createdb -U postgres $pgName

2. Khôi phục:
     pg_restore -h $pgHost -p $pgPort -U $pgUser -d $pgName --clean --if-exists mercury.dump

3. Chép uploads\, .env, templates\ trở lại thư mục dự án.

Chụp lúc: $(Get-Date -Format "yyyy-MM-dd HH:mm")
Nguồn   : $pgHost`:$pgPort/$pgName
"@
Set-Content -Path (Join-Path $staging "database\CACH-KHOI-PHUC.txt") -Value $huongDan -Encoding utf8

# --- 2. File báo cáo tàu tải lên ---
$up = Join-Path $proj "uploads"
if ((Test-Path $up) -and (Get-ChildItem $up -File -ErrorAction SilentlyContinue)) {
    Copy-Item $up (Join-Path $staging "uploads") -Recurse -Force
    $n = (Get-ChildItem $up -File -Recurse).Count
    $found += "uploads\       ($n file)"
}

# --- 3. Cấu hình bí mật ---
$envFile = Join-Path $proj ".env"
if (Test-Path $envFile) {
    Copy-Item $envFile (Join-Path $staging ".env") -Force
    $found += ".env"
}

# --- 4. Biểu mẫu Excel gốc ---
$tpl = Get-ChildItem (Join-Path $proj "templates") -Filter "*.xls*" -ErrorAction SilentlyContinue
if ($tpl) {
    New-Item -ItemType Directory -Path (Join-Path $staging "templates") -Force | Out-Null
    $tpl | ForEach-Object { Copy-Item $_.FullName (Join-Path $staging "templates") -Force }
    $found += "templates\     ($($tpl.Count) file)"
}

if ($found.Count -eq 0) {
    Write-Host "Không tìm thấy dữ liệu nào để sao lưu. Dừng lại." -ForegroundColor Red
    Remove-Item $staging -Recurse -Force
    exit 1
}

# --- Nén ---
if (-not (Test-Path $backupRoot)) { New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null }
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -Force
Remove-Item $staging -Recurse -Force

Write-Host "Đã sao lưu:" -ForegroundColor Green
$found | ForEach-Object { Write-Host "   - $_" }
Write-Host ""
Write-Host ("Xong: {0}  ({1:N1} MB)" -f $zipPath, ((Get-Item $zipPath).Length / 1MB)) -ForegroundColor Green

# --- Liệt kê các bản sao lưu đang có ---
$all = Get-ChildItem $backupRoot -Filter "backup-*.zip" | Sort-Object LastWriteTime -Descending
Write-Host ""
Write-Host "Các bản sao lưu trong $backupRoot ($($all.Count) bản):"
$all | Select-Object -First 8 | ForEach-Object {
    Write-Host ("   {0}   {1:yyyy-MM-dd HH:mm}   {2,7:N1} MB" -f $_.Name, $_.LastWriteTime, ($_.Length / 1MB))
}
if ($all.Count -gt 8) { Write-Host "   ... và $($all.Count - 8) bản cũ hơn" }
Write-Host ""
Write-Host "Cách phục hồi: giải nén file zip, chép đè uploads/.env/templates vào $proj," -ForegroundColor DarkGray
Write-Host "               riêng database dùng pg_restore — xem database\CACH-KHOI-PHUC.txt trong zip." -ForegroundColor DarkGray
