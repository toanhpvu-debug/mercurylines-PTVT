# Khôi phục dữ liệu Mercury Materials từ một bản sao lưu.
#
# Đây là chiều ngược của sao-luu-du-lieu.ps1: đưa database, file báo cáo đã tải
# lên, biểu mẫu và .env trở lại đúng trạng thái lúc sao lưu.
#
# Ba điều làm cho việc khôi phục thật sự dùng được chứ không chỉ "có script":
#
#   1. LÙI LẠI ĐƯỢC. Trước khi ghi đè, script tự chụp dữ liệu hiện tại thành
#      truoc-khi-khoi-phuc-<giờ>.zip. Khôi phục nhầm bản là chuyện hay xảy ra
#      (chọn nhầm ngày, nhớ nhầm bản); không có đường lùi thì một cú bấm sai
#      xóa sạch dữ liệu thật.
#
#   2. KIỂM CHỨNG. Sau khi khôi phục, script đối chiếu số dòng VÀ md5 nội dung
#      từng bảng với van-tay.json trong bản sao lưu. Khớp mới báo thành công.
#
#   3. KHÔNG LÀM NỬA VỜI. Nếu pg_restore lỗi, script dừng ngay và chỉ đúng
#      đường dẫn bản chụp để lùi lại, thay vì để database ở trạng thái dở dang.
#
# Dùng:
#   khoi-phuc-du-lieu.cmd                      chọn từ danh sách
#   khoi-phuc-du-lieu.cmd -File <đường dẫn>    chỉ định file zip
#   khoi-phuc-du-lieu.cmd -MoiNhat             lấy bản mới nhất
#   thêm -KhongHoi để không hỏi xác nhận (dùng khi chạy tự động)

param(
    [string]$File,
    [switch]$MoiNhat,
    [switch]$KhongHoi,
    # Chỉ khôi phục database, không đụng .env / uploads / templates.
    [switch]$ChiDatabase
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

. "$PSScriptRoot\lib-postgres.ps1"

$proj = Split-Path -Parent $PSScriptRoot
$backupRoot = "E:\backup-mercury"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Host ""
Write-Host "=== KHÔI PHỤC DỮ LIỆU MERCURY MATERIALS ===" -ForegroundColor Cyan
Write-Host "Dự án: $proj"
Write-Host ""

# --- 1. Chọn bản sao lưu ---
if (-not $File) {
    $all = Get-ChildItem $backupRoot -Filter "backup-*.zip" -ErrorAction SilentlyContinue |
           Sort-Object LastWriteTime -Descending
    if (-not $all) { throw "Không thấy bản sao lưu nào trong $backupRoot." }

    if ($MoiNhat) {
        $File = $all[0].FullName
    } else {
        Write-Host "Các bản sao lưu đang có:" -ForegroundColor Cyan
        for ($i = 0; $i -lt [Math]::Min($all.Count, 15); $i++) {
            Write-Host ("  [{0,2}] {1}   {2:yyyy-MM-dd HH:mm}   {3,7:N1} MB" -f `
                ($i + 1), $all[$i].Name, $all[$i].LastWriteTime, ($all[$i].Length / 1MB))
        }
        Write-Host ""
        $chon = Read-Host "Khôi phục bản số mấy? (Enter = 1, bản mới nhất; 0 = thoát)"
        if ($chon -eq "0") { Write-Host "Đã hủy."; exit 0 }
        if (-not $chon) { $chon = "1" }
        $idx = 0
        if (-not [int]::TryParse($chon, [ref]$idx) -or $idx -lt 1 -or $idx -gt $all.Count) {
            throw "Lựa chọn không hợp lệ: $chon"
        }
        $File = $all[$idx - 1].FullName
    }
}

if (-not (Test-Path $File)) { throw "Không thấy file $File" }
Write-Host "Bản sao lưu: $File" -ForegroundColor Yellow

# --- 2. Lấy file dump ra ---
# Nhận cả hai dạng: file zip sao lưu đầy đủ, hoặc file .dump trần — bản chụp
# "trước khi khôi phục" ở bước 5 là .dump trần, phải lùi lại được bằng chính
# script này.
$giaiNen = $null
$vanTayGoc = $null

if ([IO.Path]::GetExtension($File) -eq ".dump") {
    $dump = $File
    Write-Host "Dạng       : file .dump trần (chỉ database, không có uploads/templates)" -ForegroundColor Yellow
    $ChiDatabase = $true
} else {
    $giaiNen = Join-Path $env:TEMP "mercury-restore-$stamp"
    if (Test-Path $giaiNen) { Remove-Item $giaiNen -Recurse -Force }
    New-Item -ItemType Directory -Path $giaiNen -Force | Out-Null
    Expand-Archive -Path $File -DestinationPath $giaiNen -Force

    $dump = Join-Path $giaiNen "database\mercury.dump"
    if (-not (Test-Path $dump)) {
        throw "Bản sao lưu này không có database\mercury.dump — có thể là bản cũ thời còn dùng SQLite."
    }

    # Đọc dấu vân tay đi kèm (bản sao lưu cũ có thể chưa có).
    $fileVanTay = Join-Path $giaiNen "database\van-tay.json"
    if (Test-Path $fileVanTay) {
        $vanTayGoc = Get-Content $fileVanTay -Raw -Encoding UTF8 | ConvertFrom-Json
        Write-Host ("Nội dung   : {0} bảng, {1:N0} dòng, chụp lúc {2}" -f `
            $vanTayGoc.soBang, $vanTayGoc.tongDong, $vanTayGoc.taoLuc) -ForegroundColor Yellow
    } else {
        Write-Host "! Bản sao lưu này không kèm van-tay.json nên không đối chiếu được sau khi khôi phục." -ForegroundColor Yellow
    }
}

# --- 3. App phải tắt ---
# pg_restore --clean xóa rồi tạo lại toàn bộ bảng. App đang chạy vừa giữ kết nối
# làm lệnh xóa bị treo, vừa có thể ghi thêm dữ liệu vào giữa chừng.
$running = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($running) {
    throw "App đang chạy ở cổng 3000. Tắt bằng dung-app.cmd rồi chạy lại script này."
}

$kn = Doc-KetNoi -DuAn $proj
$pgRestore = Tim-CongCuPg "pg_restore"
$pgDump = Tim-CongCuPg "pg_dump"

Write-Host "Khôi phục vào: $($kn.May):$($kn.Cong)/$($kn.TenDb)" -ForegroundColor Yellow
Write-Host ""

# --- 4. Xác nhận ---
if (-not $KhongHoi) {
    Write-Host "Toàn bộ dữ liệu HIỆN TẠI trong database sẽ bị thay bằng dữ liệu trong bản sao lưu." -ForegroundColor Red
    Write-Host "(Dữ liệu hiện tại vẫn được chụp lại trước, lùi lại được.)" -ForegroundColor DarkGray
    $ok = Read-Host "Gõ KHOIPHUC để tiếp tục"
    if ($ok -ne "KHOIPHUC") { Write-Host "Đã hủy."; exit 0 }
    Write-Host ""
}

# --- 5. Chụp lại dữ liệu hiện tại (đường lùi) ---
$duongLui = Join-Path $backupRoot "truoc-khi-khoi-phuc-$stamp.dump"
if (-not (Test-Path $backupRoot)) { New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null }
Write-Host "Đang chụp lại dữ liệu hiện tại để lùi lại được..." -ForegroundColor DarkGray
$logLui = Join-Path $env:TEMP "mercury-duonglui-$stamp.log"
$ma = Chay-Lenh -Exe $pgDump -MatKhau $kn.MatKhau -FileLog $logLui -ThamSo @(
    "-h", $kn.May, "-p", $kn.Cong, "-U", $kn.NguoiDung, "-d", $kn.TenDb, "-Fc", "-f", $duongLui
)
if ($ma -ne 0) {
    Get-Content $logLui -Tail 10 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
    throw "Không chụp được dữ liệu hiện tại — dừng lại, KHÔNG khôi phục để tránh mất dữ liệu không lùi được."
}
Remove-Item $logLui -Force -ErrorAction SilentlyContinue
Write-Host ("   đã lưu: {0}  ({1:N0} KB)" -f $duongLui, ((Get-Item $duongLui).Length / 1KB)) -ForegroundColor DarkGray

# --- 6. Ngắt các kết nối còn sót ---
# Còn một kết nối treo là DROP TABLE nằm chờ vô hạn, script đứng im không rõ lý do.
$sqlNgat = @"
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname = '$($kn.TenDb)' AND pid <> pg_backend_pid();
"@
Chay-Sql -KetNoi $kn -Sql $sqlNgat | Out-Null

# --- 7. Khôi phục database ---
Write-Host "Đang khôi phục database..." -ForegroundColor DarkGray
$logRestore = Join-Path $env:TEMP "mercury-restore-$stamp.log"
# --clean --if-exists: xóa bảng cũ trước khi tạo lại, không kêu nếu bảng chưa có.
# --no-owner --no-privileges: khôi phục được sang máy có tên tài khoản khác.
$maLoi = Chay-Lenh -Exe $pgRestore -MatKhau $kn.MatKhau -FileLog $logRestore -ThamSo @(
    "-h", $kn.May, "-p", $kn.Cong, "-U", $kn.NguoiDung, "-d", $kn.TenDb,
    "--clean", "--if-exists", "--no-owner", "--no-privileges", $dump
)

if ($maLoi -ne 0) {
    Write-Host ""
    Write-Host "pg_restore báo lỗi (mã $maLoi). Vài dòng cuối:" -ForegroundColor Red
    Get-Content $logRestore -Tail 15 | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "Dữ liệu trước khi khôi phục vẫn còn ở:" -ForegroundColor Yellow
    Write-Host "   $duongLui" -ForegroundColor Yellow
    Write-Host "Lùi lại bằng:" -ForegroundColor Yellow
    Write-Host "   khoi-phuc-du-lieu.cmd -File `"$duongLui`"" -ForegroundColor Yellow
    throw "Khôi phục database thất bại."
}

# --- 8. Đối chiếu dấu vân tay ---
$khop = $true
if ($vanTayGoc) {
    Write-Host "Đang đối chiếu dữ liệu sau khi khôi phục..." -ForegroundColor DarkGray
    $sau = Lay-VanTay -KetNoi $kn

    $truoc = [ordered]@{}
    foreach ($p in $vanTayGoc.bang.PSObject.Properties) {
        $truoc[$p.Name] = [pscustomobject]@{ so = [int64]$p.Value.so; md5 = [string]$p.Value.md5 }
    }
    $khop = So-VanTay -Truoc $truoc -Sau $sau

    if ($khop) {
        $tong = ($sau.Values | Measure-Object -Property so -Sum).Sum
        Write-Host ("   khớp: {0} bảng, {1:N0} dòng, nội dung giống hệt bản sao lưu." -f $sau.Count, $tong) -ForegroundColor Green
    }
}

# --- 9. File đi kèm ---
if (-not $ChiDatabase) {
    $upGoc = Join-Path $giaiNen "uploads"
    if (Test-Path $upGoc) {
        $upDich = Join-Path $proj "uploads"
        New-Item -ItemType Directory -Path $upDich -Force | Out-Null
        Copy-Item (Join-Path $upGoc "*") $upDich -Recurse -Force
        Write-Host "   uploads\   đã chép lại $((Get-ChildItem $upGoc -File -Recurse).Count) file" -ForegroundColor Green
    }

    $tplGoc = Join-Path $giaiNen "templates"
    if (Test-Path $tplGoc) {
        $tplDich = Join-Path $proj "templates"
        New-Item -ItemType Directory -Path $tplDich -Force | Out-Null
        Copy-Item (Join-Path $tplGoc "*") $tplDich -Recurse -Force
        Write-Host "   templates\ đã chép lại $((Get-ChildItem $tplGoc -File).Count) file" -ForegroundColor Green
    }

    # .env: KHÔNG ghi đè tự động. File này chứa mật khẩu database của MÁY NÀY,
    # ghi đè bằng .env của máy khác là app mất kết nối ngay. Để cạnh cho tự so.
    $envGoc = Join-Path $giaiNen ".env"
    $envDich = Join-Path $proj ".env"
    if (Test-Path $envGoc) {
        if (-not (Test-Path $envDich)) {
            Copy-Item $envGoc $envDich -Force
            Write-Host "   .env       chưa có nên đã chép từ bản sao lưu" -ForegroundColor Green
        } else {
            $envKem = Join-Path $proj ".env.tu-ban-sao-luu"
            Copy-Item $envGoc $envKem -Force
            Write-Host "   .env       giữ nguyên file hiện tại (chứa mật khẩu của máy này)." -ForegroundColor Yellow
            Write-Host "              bản trong sao lưu để ở .env.tu-ban-sao-luu nếu cần đối chiếu." -ForegroundColor Yellow
        }
    }
}

if ($giaiNen) { Remove-Item $giaiNen -Recurse -Force -ErrorAction SilentlyContinue }
Remove-Item $logRestore -Force -ErrorAction SilentlyContinue

Write-Host ""
if ($khop) {
    Write-Host "=== KHÔI PHỤC XONG ===" -ForegroundColor Green
} else {
    Write-Host "=== KHÔI PHỤC XONG NHƯNG DỮ LIỆU KHÔNG KHỚP BẢN SAO LƯU ===" -ForegroundColor Red
    Write-Host "Xem danh sách khác biệt ở trên trước khi dùng tiếp." -ForegroundColor Red
}
Write-Host "Dữ liệu trước khi khôi phục: $duongLui" -ForegroundColor DarkGray
Write-Host "Lùi lại: khoi-phuc-du-lieu.cmd -File `"$duongLui`"" -ForegroundColor DarkGray
Write-Host "Chạy app: chay-app.cmd" -ForegroundColor DarkGray
Write-Host ""

if (-not $khop) { exit 1 }
