# Sao lưu dữ liệu vận hành của Mercury Materials.
#
# Sao lưu đúng những thứ KHÔNG nằm trên GitHub (vì chúng là dữ liệu, không phải mã nguồn):
#   - database\mercury.dump  bản chụp PostgreSQL: tồn kho, yêu cầu, đơn mua, tài khoản...
#   - database\van-tay.json  số dòng + md5 nội dung từng bảng, để đối chiếu khi khôi phục
#   - uploads\               file báo cáo tàu đã tải lên
#   - .env                   khóa session + thông tin công ty in trên chứng từ
#   - templates\*.xlsx       biểu mẫu Excel gốc của công ty
#
# Kết quả: <thư mục sao lưu>\backup-YYYYMMDD-HHmm.zip
# Chỗ để bản sao lưu do scripts\lib-sao-luu.ps1 quyết định — xem thứ tự tìm ở
# đầu file đó. Muốn chỉ định thẳng: đặt BACKUP_DIR trong .env.
#
# Khôi phục: chạy khoi-phuc-du-lieu.cmd (đọc thẳng file zip này).

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

. "$PSScriptRoot\lib-postgres.ps1"
. "$PSScriptRoot\lib-sao-luu.ps1"

$proj = Split-Path -Parent $PSScriptRoot
$cho = Tim-ThuMucSaoLuu -DuAn $proj
$backupRoot = $cho.Duong
$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$zipPath = Join-Path $backupRoot "backup-$stamp.zip"

Write-Host ""
Write-Host "=== SAO LƯU DỮ LIỆU MERCURY MATERIALS ===" -ForegroundColor Cyan
Write-Host "Dự án : $proj"
Write-Host "Lưu về: $zipPath  ($($cho.Nguon))"
Canh-Bao-CungODia -Cho $cho
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
# Trước đây script chép file prisma\dev.db; sau khi chuyển sang PostgreSQL thì
# file đó chỉ còn là bản SQLite cũ đóng băng — sao lưu nó là sao lưu nhầm.
$kn = Doc-KetNoi -DuAn $proj
$pgDump = Tim-CongCuPg "pg_dump"
$pgRestore = Tim-CongCuPg "pg_restore"

New-Item -ItemType Directory -Path (Join-Path $staging "database") -Force | Out-Null
$dumpOut = Join-Path $staging "database\mercury.dump"

# Định dạng custom (-Fc): nén sẵn, khôi phục bằng pg_restore, chọn được từng bảng.
$logDump = Join-Path $env:TEMP "mercury-pgdump-$stamp.log"
$ma = Chay-Lenh -Exe $pgDump -MatKhau $kn.MatKhau -FileLog $logDump -ThamSo @(
    "-h", $kn.May, "-p", $kn.Cong, "-U", $kn.NguoiDung, "-d", $kn.TenDb, "-Fc", "-f", $dumpOut
)
if ($ma -ne 0) {
    Get-Content $logDump -Tail 10 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
    throw "pg_dump trả về mã lỗi $ma — không sao lưu được database."
}
Remove-Item $logDump -Force -ErrorAction SilentlyContinue
$found += "database\mercury.dump  ({0:N0} KB)" -f ((Get-Item $dumpOut).Length / 1KB)

# --- 2. Dấu vân tay dữ liệu ---
# Một bản sao lưu chỉ đáng tin khi kiểm chứng được. Ghi số dòng + md5 nội dung
# từng bảng để lúc khôi phục đối chiếu đúng đến từng ô dữ liệu, chứ không chỉ
# "file có tồn tại".
Write-Host "Đang tính dấu vân tay dữ liệu..." -ForegroundColor DarkGray
$vanTay = Lay-VanTay -KetNoi $kn
$tongDong = ($vanTay.Values | Measure-Object -Property so -Sum).Sum
$manifest = [ordered]@{
    taoLuc   = (Get-Date).ToString("s")
    database = $kn.TenDb
    nguon    = "$($kn.May):$($kn.Cong)/$($kn.TenDb)"
    soBang   = $vanTay.Count
    tongDong = $tongDong
    bang     = $vanTay
}
$manifest | ConvertTo-Json -Depth 5 |
    Set-Content -Path (Join-Path $staging "database\van-tay.json") -Encoding utf8
$found += "database\van-tay.json  ($($vanTay.Count) bảng, {0:N0} dòng)" -f $tongDong

# --- 3. Kiểm tra file dump có đọc được không ---
# pg_dump báo thành công vẫn có thể ra file hỏng (hết đĩa, ổ lỗi). Đọc thử mục
# lục ngay bây giờ, lúc còn cứu được, thay vì phát hiện lúc cần khôi phục.
$logList = Join-Path $env:TEMP "mercury-pglist-$stamp.log"
$ma = Chay-Lenh -Exe $pgRestore -FileLog $logList -ThamSo @("--list", $dumpOut)
if ($ma -ne 0) {
    throw "File dump vừa tạo KHÔNG đọc được — bản sao lưu này hỏng, không dùng được."
}
$soBangTrongDump = (Get-Content $logList | Select-String -SimpleMatch "TABLE DATA").Count
Remove-Item $logList -Force -ErrorAction SilentlyContinue
Write-Host "Đã kiểm tra file dump: đọc được, có $soBangTrongDump bảng dữ liệu." -ForegroundColor DarkGray

# --- 4. File báo cáo tàu tải lên ---
$up = Join-Path $proj "uploads"
if ((Test-Path $up) -and (Get-ChildItem $up -File -ErrorAction SilentlyContinue)) {
    Copy-Item $up (Join-Path $staging "uploads") -Recurse -Force
    $n = (Get-ChildItem $up -File -Recurse).Count
    $found += "uploads\       ($n file)"
}

# --- 5. Cấu hình bí mật ---
$envFile = Join-Path $proj ".env"
if (Test-Path $envFile) {
    Copy-Item $envFile (Join-Path $staging ".env") -Force
    $found += ".env"
}

# --- 6. Biểu mẫu Excel gốc ---
$tpl = Get-ChildItem (Join-Path $proj "templates") -Filter "*.xls*" -ErrorAction SilentlyContinue
if ($tpl) {
    New-Item -ItemType Directory -Path (Join-Path $staging "templates") -Force | Out-Null
    $tpl | ForEach-Object { Copy-Item $_.FullName (Join-Path $staging "templates") -Force }
    $found += "templates\     ($($tpl.Count) file)"
}

# --- 7. Hướng dẫn khôi phục bằng tay (khi không còn thư mục dự án) ---
$huongDan = @"
KHÔI PHỤC DỮ LIỆU MERCURY MATERIALS
===================================

CÁCH THƯỜNG DÙNG
Chạy khoi-phuc-du-lieu.cmd trong thư mục dự án rồi chọn bản sao lưu này.
Script tự chụp lại dữ liệu hiện tại trước khi ghi đè (để lùi lại được),
tự khôi phục database + uploads + templates, rồi đối chiếu dấu vân tay.

KHÔI PHỤC BẰNG TAY (khi máy mới, chưa có thư mục dự án)

1. Tạo database rỗng nếu chưa có (cần quyền tạo database):
     createdb -U postgres $($kn.TenDb)
     psql -U postgres -c "CREATE USER $($kn.NguoiDung) WITH PASSWORD '...';"
     psql -U postgres -c "ALTER DATABASE $($kn.TenDb) OWNER TO $($kn.NguoiDung);"

2. Khôi phục database:
     pg_restore -h $($kn.May) -p $($kn.Cong) -U $($kn.NguoiDung) -d $($kn.TenDb) --clean --if-exists mercury.dump

3. Chép .env, uploads\, templates\ trở lại thư mục dự án.

4. Đối chiếu với van-tay.json: số dòng từng bảng phải khớp.

Chụp lúc: $(Get-Date -Format "yyyy-MM-dd HH:mm")
Nguồn   : $($kn.May):$($kn.Cong)/$($kn.TenDb)
Gồm     : $($vanTay.Count) bảng, $tongDong dòng
"@
Set-Content -Path (Join-Path $staging "database\CACH-KHOI-PHUC.txt") -Value $huongDan -Encoding utf8

if ($found.Count -eq 0) {
    Write-Host "Không tìm thấy dữ liệu nào để sao lưu. Dừng lại." -ForegroundColor Red
    Remove-Item $staging -Recurse -Force
    exit 1
}

# --- Nén ---
if (-not (Test-Path $backupRoot)) { New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null }
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -Force
Remove-Item $staging -Recurse -Force

Write-Host ""
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
Write-Host "Khôi phục: chạy khoi-phuc-du-lieu.cmd" -ForegroundColor DarkGray
