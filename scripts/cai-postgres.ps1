# Dựng PostgreSQL cho Mercury Materials trên một máy mới — chạy MỘT LẦN.
#
# Máy mới chỉ có mã nguồn thì giữa "đã cài PostgreSQL" và "app chạy được" còn
# bốn việc rời rạc, trước đây phải nhớ và gõ tay đúng thứ tự: tạo tài khoản
# riêng cho app, tạo database, tạo bảng theo schema, chép dữ liệu cũ sang. Sai
# hoặc bỏ sót một bước thì app vẫn khởi động nhưng mọi trang đều báo lỗi — kiểu
# hỏng khó đoán nhất. File này gộp cả bốn, và dừng ngay ở bước đầu tiên thất bại.
#
# KHÔNG cài PostgreSQL hộ: bước đó cần quyền quản trị máy và một mật khẩu do
# người dùng tự chọn. Chưa cài thì script in ra đúng lệnh cần chạy rồi dừng.
#
# Chạy lại được nhiều lần: việc nào đã xong thì bỏ qua, không làm hỏng dữ liệu.

[CmdletBinding()]
param(
    # Mật khẩu tài khoản quản trị 'postgres' đã đặt lúc cài. Bỏ trống thì hỏi.
    [string]$MatKhauQuanTri,
    # Chỉ tạo bảng trống, không chép dữ liệu từ prisma\dev.db sang.
    [switch]$BoQuaDuLieu,
    # Postgres đã có dữ liệu thì mặc định script không chép đè; bật cờ này để
    # xoá sạch bên Postgres rồi chép lại từ đầu.
    [switch]$GhiDe
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$proj = Split-Path -Parent $PSScriptRoot
Set-Location $proj
. (Join-Path $PSScriptRoot "lib-postgres.ps1")

function Loi($msg) {
    Write-Host ""
    Write-Host "DỪNG LẠI" -ForegroundColor Red
    Write-Host $msg -ForegroundColor Yellow
    Write-Host ""
}

function Buoc($so, $ten) {
    Write-Host ""
    Write-Host "[$so] $ten" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "=== DỰNG DATABASE CHO MERCURY MATERIALS ===" -ForegroundColor Cyan

# ─── [1] PostgreSQL đã có trên máy chưa ──────────────────────────────────────
Buoc 1 "Tìm PostgreSQL"

$psql = $null
try {
    $psql = Tim-CongCuPg "psql"
} catch {
    $lenh = 'winget install --id PostgreSQL.PostgreSQL.17 --silent --accept-package-agreements --override "--unattendedmodeui none --mode unattended --superpassword MAT_KHAU --serverport 5432"'
    Loi ("Máy này chưa cài PostgreSQL.`n`n" +
         "Mở PowerShell QUYỀN QUẢN TRỊ, thay MAT_KHAU bằng mật khẩu bạn tự chọn rồi chạy:`n`n" +
         "  $lenh`n`n" +
         "Cài xong bấm đúp lại cai-postgres.cmd và nhập đúng mật khẩu đó.")
    exit 1
}
Write-Host "  $psql" -ForegroundColor DarkGray

# ─── [2] Dịch vụ đã chạy chưa ────────────────────────────────────────────────
Buoc 2 "Bật dịch vụ PostgreSQL"

$dv = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($dv) {
    if ($dv.Status -ne "Running") {
        Write-Host "  $($dv.Name) đang $($dv.Status) — đang bật..." -ForegroundColor Yellow
        try {
            Start-Service $dv.Name
            $dv.WaitForStatus("Running", [TimeSpan]::FromSeconds(30))
        } catch {
            Loi ("Không bật được dịch vụ $($dv.Name).`n" +
                 "Mở PowerShell quyền quản trị rồi chạy:  Start-Service $($dv.Name)")
            exit 1
        }
    }
    Write-Host "  $($dv.Name): Running" -ForegroundColor DarkGray
} else {
    # Cài kiểu xách tay hoặc chạy trong container thì không có dịch vụ Windows;
    # không coi là lỗi, để bước kiểm tra cổng ngay dưới phán quyết.
    Write-Host "  Không thấy dịch vụ Windows nào tên postgresql* — bỏ qua." -ForegroundColor DarkGray
}

# ─── [3] Đọc .env, kiểm tra cổng có trả lời không ────────────────────────────
Buoc 3 "Đọc DATABASE_URL và thử kết nối"

try {
    $kn = Doc-KetNoi -DuAn $proj
} catch {
    Loi ("Không đọc được DATABASE_URL trong .env.`n$($_.Exception.Message)`n`n" +
         "Chép .env.example thành .env rồi điền DATABASE_URL dạng:`n" +
         "  postgresql://mercury:MAT_KHAU_RIENG@localhost:5432/mercury?schema=public")
    exit 1
}
Write-Host "  $($kn.NguoiDung)@$($kn.May):$($kn.Cong)/$($kn.TenDb)" -ForegroundColor DarkGray

$tcp = New-Object System.Net.Sockets.TcpClient
try {
    $noi = $tcp.BeginConnect($kn.May, [int]$kn.Cong, $null, $null)
    $kip = $noi.AsyncWaitHandle.WaitOne(5000, $false) -and $tcp.Connected
} catch {
    $kip = $false
} finally {
    $tcp.Close()
}
if (-not $kip) {
    Loi ("PostgreSQL ở $($kn.May):$($kn.Cong) không trả lời.`n" +
         "Dịch vụ đã bật chưa, và cổng trong .env có đúng cổng lúc cài không?")
    exit 1
}
Write-Host "  Cổng trả lời." -ForegroundColor DarkGray

# ─── [4] Tạo tài khoản riêng và database cho app ─────────────────────────────
# App KHÔNG dùng tài khoản 'postgres': tài khoản đó sửa được mọi database trên
# máy, một lỗi SQL của app cũng thành sự cố toàn máy chủ.
Buoc 4 "Tạo tài khoản và database cho app"

if (-not $MatKhauQuanTri) {
    Write-Host "  Nhập mật khẩu tài khoản quản trị 'postgres' (đã đặt lúc cài PostgreSQL):" -ForegroundColor Yellow
    $bimat = Read-Host -AsSecureString "  Mật khẩu"
    $MatKhauQuanTri = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($bimat))
}
if (-not $MatKhauQuanTri) {
    Loi "Chưa có mật khẩu quản trị nên không tạo được tài khoản cho app."
    exit 1
}

$quanTri = [pscustomobject]@{
    NguoiDung = "postgres"
    MatKhau   = $MatKhauQuanTri
    May       = $kn.May
    Cong      = $kn.Cong
    TenDb     = "postgres"
}

try {
    Chay-Sql -KetNoi $quanTri -Sql "SELECT 1;" | Out-Null
} catch {
    Loi ("Đăng nhập bằng tài khoản 'postgres' thất bại — sai mật khẩu?`n$($_.Exception.Message)")
    exit 1
}

# Nháy đơn trong SQL phải nhân đôi, nếu không mật khẩu có dấu ' làm hỏng câu lệnh.
$mkApp    = $kn.MatKhau   -replace "'", "''"
$tenApp   = $kn.NguoiDung -replace '"', '""'
$tenDb    = $kn.TenDb     -replace '"', '""'
$tenAppSq = $kn.NguoiDung -replace "'", "''"
$tenDbSq  = $kn.TenDb     -replace "'", "''"

$coRole = Chay-Sql -KetNoi $quanTri -Sql "SELECT 1 FROM pg_roles WHERE rolname = '$tenAppSq';"
if ($coRole) {
    # Đồng bộ lại mật khẩu theo .env: tài khoản có sẵn từ lần cài trước mà mật
    # khẩu khác thì app không kết nối được, mà lỗi lại hiện ra tận lúc chạy.
    Chay-Sql -KetNoi $quanTri -Sql "ALTER ROLE ""$tenApp"" WITH LOGIN PASSWORD '$mkApp';" | Out-Null
    Write-Host "  Tài khoản '$($kn.NguoiDung)' đã có — đã đặt lại mật khẩu theo .env." -ForegroundColor DarkGray
} else {
    Chay-Sql -KetNoi $quanTri -Sql "CREATE ROLE ""$tenApp"" WITH LOGIN PASSWORD '$mkApp';" | Out-Null
    Write-Host "  Đã tạo tài khoản '$($kn.NguoiDung)'." -ForegroundColor Green
}

$coDb = Chay-Sql -KetNoi $quanTri -Sql "SELECT 1 FROM pg_database WHERE datname = '$tenDbSq';"
if ($coDb) {
    Write-Host "  Database '$($kn.TenDb)' đã có — giữ nguyên." -ForegroundColor DarkGray
} else {
    # TEMPLATE template0 để chắc chắn bảng mã UTF8, không thừa hưởng bảng mã
    # lỗi từ template1 của bản cài Windows.
    Chay-Sql -KetNoi $quanTri -Sql "CREATE DATABASE ""$tenDb"" OWNER ""$tenApp"" ENCODING 'UTF8' TEMPLATE template0;" | Out-Null
    Write-Host "  Đã tạo database '$($kn.TenDb)'." -ForegroundColor Green
}

# Từ PostgreSQL 15, thành viên thường không còn quyền tạo bảng trong schema
# public. Chủ database có quyền qua pg_database_owner, nhưng cấp thẳng cho chắc
# — trường hợp database được người khác tạo sẵn thì không có quyền đó.
Chay-Sql -KetNoi $quanTri -TenDb $kn.TenDb -Sql "GRANT ALL ON SCHEMA public TO ""$tenApp"";" | Out-Null

try {
    Chay-Sql -KetNoi $kn -Sql "SELECT 1;" | Out-Null
    Write-Host "  App kết nối được bằng tài khoản riêng." -ForegroundColor Green
} catch {
    Loi ("Tạo xong nhưng app vẫn không kết nối được bằng tài khoản '$($kn.NguoiDung)'.`n$($_.Exception.Message)")
    exit 1
}

# ─── [5] Tìm Node.js ─────────────────────────────────────────────────────────
Buoc 5 "Tìm Node.js"

# KHÔNG ghim cứng số phiên bản Playwright: nó cập nhật là đường dẫn đổi.
$nodeExe = $null
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeExe = "node"
} else {
    $pwRoot = Join-Path $env:LOCALAPPDATA "ms-playwright-go"
    if (Test-Path $pwRoot) {
        $cand = Get-ChildItem $pwRoot -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending |
            ForEach-Object { Join-Path $_.FullName "node.exe" } |
            Where-Object { Test-Path $_ } | Select-Object -First 1
        if ($cand) { $nodeExe = $cand }
    }
    if (-not $nodeExe) {
        foreach ($p in @("$env:ProgramFiles\nodejs\node.exe",
                         "${env:ProgramFiles(x86)}\nodejs\node.exe",
                         "$env:LOCALAPPDATA\hermes\node\node.exe")) {
            if (Test-Path $p) { $nodeExe = $p; break }
        }
    }
}
if (-not $nodeExe) {
    Loi "Không tìm thấy Node.js trên máy.`nCài Node.js LTS tại https://nodejs.org rồi chạy lại file này."
    exit 1
}
if (-not (Test-Path (Join-Path $proj "node_modules\next"))) {
    Loi "Thiếu thư mục node_modules.`nGiải nén lại từ bản đóng gói, hoặc chạy: npm install"
    exit 1
}
Write-Host "  $nodeExe" -ForegroundColor DarkGray

# ─── [6] Tạo bảng theo schema ────────────────────────────────────────────────
Buoc 6 "Tạo bảng (prisma migrate deploy)"

& $nodeExe "node_modules\prisma\build\index.js" migrate deploy
if ($LASTEXITCODE -ne 0) {
    Loi "Tạo bảng thất bại — xem lỗi ở trên."
    exit 1
}
& $nodeExe "node_modules\prisma\build\index.js" generate
if ($LASTEXITCODE -ne 0) {
    Loi "Sinh Prisma Client thất bại — xem lỗi ở trên."
    exit 1
}

$soBang = Chay-Sql -KetNoi $kn -Sql "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
Write-Host "  Đã có $soBang bảng trong schema public." -ForegroundColor Green

# ─── [7] Chép dữ liệu từ bản SQLite cũ ───────────────────────────────────────
Buoc 7 "Chép dữ liệu từ prisma\dev.db"

$fileSqlite = Join-Path $proj "prisma\dev.db"
if ($BoQuaDuLieu) {
    Write-Host "  Bỏ qua theo yêu cầu (-BoQuaDuLieu). Database đang trống." -ForegroundColor Yellow
} elseif (-not (Test-Path $fileSqlite)) {
    Write-Host "  Không thấy prisma\dev.db — bỏ qua. Muốn có dữ liệu mẫu thì chạy:" -ForegroundColor Yellow
    Write-Host "    $nodeExe --import ./node_modules/tsx/dist/loader.mjs ./prisma/seed.ts" -ForegroundColor Yellow
} else {
    $thamSo = @("--conditions=react-server",
                "--import", "./node_modules/tsx/dist/loader.mjs",
                "./scripts/chuyen-sang-postgres.ts")
    if ($GhiDe) { $thamSo += "--ghi-de" }
    & $nodeExe @thamSo
    if ($LASTEXITCODE -ne 0) {
        Loi ("Chép dữ liệu chưa xong — xem lỗi ở trên.`n" +
             "Nếu báo Postgres đã có dữ liệu: chạy lại file này với cờ -GhiDe để chép đè.")
        exit 1
    }
}

# ─── [8] Xong ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== XONG ===" -ForegroundColor Green
try {
    $soNguoi = Chay-Sql -KetNoi $kn -Sql "SELECT count(*) FROM ""User"";"
    $soTau   = Chay-Sql -KetNoi $kn -Sql "SELECT count(*) FROM ""Vessel"";"
    $soVatTu = Chay-Sql -KetNoi $kn -Sql "SELECT count(*) FROM ""Material"";"
    Write-Host "  $soNguoi tài khoản · $soTau tàu · $soVatTu vật tư" -ForegroundColor Green
    if ([int]$soNguoi -eq 0) {
        Write-Host "  Chưa có tài khoản nào nên CHƯA ĐĂNG NHẬP ĐƯỢC. Tạo dữ liệu mẫu:" -ForegroundColor Yellow
        Write-Host "    $nodeExe --import ./node_modules/tsx/dist/loader.mjs ./prisma/seed.ts" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  (Không đếm được số dòng: $($_.Exception.Message))" -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "Bước tiếp theo: bấm đúp chay-app.cmd rồi mở http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
