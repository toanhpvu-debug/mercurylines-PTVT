# Sao lưu dữ liệu vận hành của Mercury Materials.
#
# Sao lưu đúng những thứ KHÔNG nằm trên GitHub (vì chúng là dữ liệu, không phải mã nguồn):
#   - prisma\dev.db          database: tồn kho, yêu cầu, đơn mua, tài khoản...
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

# --- 1. Database ---
$db = Join-Path $proj "prisma\dev.db"
if (Test-Path $db) {
    New-Item -ItemType Directory -Path (Join-Path $staging "prisma") -Force | Out-Null
    $dbOut = Join-Path $staging "prisma\dev.db"
    # Ưu tiên SQLite Online Backup API (chụp nhất quán kể cả khi app đang ghi).
    # Không có Python thì chép thẳng file — vẫn đúng khi app đang rảnh.
    $copied = $false
    if (Get-Command python -ErrorAction SilentlyContinue) {
        $py = "import sqlite3,sys" + "`n" +
              "s=sqlite3.connect(sys.argv[1]); d=sqlite3.connect(sys.argv[2])" + "`n" +
              "s.backup(d); d.close(); s.close()"
        try {
            $py | python - $db $dbOut
            if ($LASTEXITCODE -eq 0 -and (Test-Path $dbOut)) { $copied = $true }
        } catch { }
    }
    if (-not $copied) { Copy-Item $db $dbOut -Force }
    $found += "prisma\dev.db  ({0:N0} KB)" -f ((Get-Item $dbOut).Length / 1KB)
} else {
    Write-Host "! Không tìm thấy prisma\dev.db" -ForegroundColor Yellow
}

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
Write-Host "Cách phục hồi: giải nén file zip rồi chép đè các thư mục vào $proj" -ForegroundColor DarkGray
