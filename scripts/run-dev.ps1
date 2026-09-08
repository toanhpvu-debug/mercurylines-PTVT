# Chạy Mercury Materials ở chế độ DEVELOPMENT (có hot-reload, dùng khi đang sửa code).
# Chậm hơn production khoảng 50 lần — để làm việc hằng ngày hãy dùng chay-app.cmd.
#
# Vì sao đường chạy dev cũng phải kiểm tra trước khi chạy: `next dev` vẫn khởi động
# ngon lành khi PostgreSQL đang tắt, phải mở trang mới lòi ra lỗi Prisma khó hiểu.
# Người dùng bấm đúp run-dev.cmd, thấy app lên, rồi MỌI trang đều báo lỗi mà không
# đoán được nguyên nhân. Các bước kiểm tra dưới đây lấy đúng khuôn của
# scripts\chay-app.ps1 để hai đường chạy hỏng giống nhau thì báo giống nhau.

# Cố ý KHÔNG khai báo param(): mọi tham số đưa vào được `$args` hứng nguyên vẹn rồi
# chuyển thẳng cho `next dev`, đúng như "%*" mà run-dev.cmd vẫn làm từ trước. Đã thử
# cách param([Parameter(ValueFromRemainingArguments)]) và nó NUỐT MẤT các tham số bắt
# đầu bằng dấu gạch: gọi kèm "-p 3001" thì biến nhận về rỗng, next vẫn nghe cổng 3000.

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$proj = Split-Path -Parent $PSScriptRoot
Set-Location $proj

function Loi($msg) {
    Write-Host ""
    Write-Host "KHÔNG CHẠY ĐƯỢC" -ForegroundColor Red
    Write-Host $msg -ForegroundColor Yellow
    Write-Host ""
}

Write-Host ""
Write-Host "=== MERCURY MATERIALS (development) ===" -ForegroundColor Cyan

# ─── Tìm node.exe ────────────────────────────────────────────────────────────
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
                         "${env:ProgramFiles(x86)}\nodejs\node.exe")) {
            if (Test-Path $p) { $nodeExe = $p; break }
        }
    }
}
if (-not $nodeExe) {
    Loi "Không tìm thấy Node.js trên máy.`nCài Node.js LTS tại https://nodejs.org rồi chạy lại file này."
    return
}

# ─── Kiểm tra điều kiện trước khi chạy ───────────────────────────────────────
if (-not (Test-Path (Join-Path $proj "node_modules\next"))) {
    Loi "Thiếu thư mục node_modules.`nGiải nén lại từ mercury-materials.7z, hoặc chạy: npm install"
    return
}
if (-not (Test-Path (Join-Path $proj ".env"))) {
    Loi "Thiếu file .env (chứa DATABASE_URL và SESSION_SECRET).`nChép từ .env.example rồi điền giá trị."
    return
}

# Database là PostgreSQL chứ không còn là file prisma\dev.db, nên chỉ có một cách biết
# nó sống hay chết: mở thử kết nối tới đúng máy chủ và cổng ghi trong DATABASE_URL.
# Đây chính là bước mà đường chạy dev còn thiếu — thiếu nó thì app vẫn lên bình thường
# và người dùng chỉ phát hiện ra database tắt qua đống lỗi Prisma ở từng trang.
. (Join-Path $PSScriptRoot "lib-postgres.ps1")
# Doc-KetNoi bắt buộc chuỗi kết nối phải ghi cổng tường minh (biểu thức khớp @host:port/),
# trong khi chính .env.example nêu Neon/Supabase/Railway là cấu hình được hỗ trợ — chuỗi
# của các dịch vụ đó thường không ghi cổng. Coi "không tách được host:port" là lý do từ
# chối chạy thì bước kiểm sinh ra để GIÚP người dùng lại chặn cả một database hoàn toàn
# khỏe, và còn báo sai hướng ("không đọc được DATABASE_URL") trong khi biến rất đúng.
# Vì vậy chỉ chặn khi THIẾU HẲN biến hoặc thiếu file; tách không ra thì hạ xuống mức
# cảnh báo, bỏ bước kiểm máy chủ và chạy tiếp.
$kn = $null
try {
    $kn = Doc-KetNoi -DuAn $proj
} catch {
    if ($_.Exception.Message -like "*không phải chuỗi kết nối PostgreSQL hợp lệ*") {
        Write-Host ""
        Write-Host "Không tách được máy chủ/cổng từ DATABASE_URL (chuỗi dịch vụ đám mây?) — bỏ qua bước kiểm database." -ForegroundColor Yellow
        Write-Host "Nếu mọi trang đều báo lỗi Prisma thì hãy tự kiểm tra database bằng tay." -ForegroundColor DarkGray
    } else {
        Loi "Không đọc được DATABASE_URL trong .env.`n$($_.Exception.Message)"
        return
    }
}
if ($kn) {
    $tcp = New-Object System.Net.Sockets.TcpClient
    try {
        $noi = $tcp.BeginConnect($kn.May, [int]$kn.Cong, $null, $null)
        $kip = $noi.AsyncWaitHandle.WaitOne(3000, $false) -and $tcp.Connected
    } catch {
        $kip = $false
    } finally {
        $tcp.Close()
    }
    # Bản PostgreSQL riêng của dự án (pgsql/pgdata cạnh thư mục dự án) không phải Windows
    # service nên không tự bật sau khi khởi động máy. Thử bật hộ trước khi từ chối chạy,
    # để người dùng không phải nhớ thêm một bước thủ công.
    if (-not $kip) {
        $batHo = Join-Path $PSScriptRoot "postgres-rieng.ps1"
        $gocDuAn = Split-Path -Parent $proj
        if ((Test-Path $batHo) -and (Test-Path (Join-Path $gocDuAn "pgdata"))) {
            Write-Host ""
            Write-Host "PostgreSQL chưa chạy — đang bật bản riêng của dự án..." -ForegroundColor Yellow
            & powershell -NoProfile -ExecutionPolicy Bypass -File $batHo -ViecCanLam chay
            $tcp2 = New-Object System.Net.Sockets.TcpClient
            try {
                $noi2 = $tcp2.BeginConnect($kn.May, [int]$kn.Cong, $null, $null)
                $kip = $noi2.AsyncWaitHandle.WaitOne(5000, $false) -and $tcp2.Connected
            } catch {
                $kip = $false
            } finally {
                $tcp2.Close()
            }
        }
    }
    if (-not $kip) {
        Loi ("PostgreSQL ở $($kn.May):$($kn.Cong) không trả lời — app chạy được nhưng mọi trang sẽ báo lỗi.`n" +
             "Bản PostgreSQL riêng của dự án: bấm đúp khoi-dong-postgres.cmd`n" +
             "Bản cài dạng dịch vụ Windows: mở PowerShell quyền quản trị rồi chạy   Start-Service postgresql-x64-17`n" +
             "Chưa cài PostgreSQL: xem mục ""Cài PostgreSQL trên máy Windows"" trong README.md")
        return
    }
}

# ─── Cổng 3000 có đang bị chiếm không ────────────────────────────────────────
# Ở đây chỉ CẢNH BÁO rồi chạy tiếp, khác hẳn scripts\chay-app.ps1. Lý do: `next dev`
# tự né cổng, còn `next start` thì không —
# node_modules\next\dist\server\lib\start-server.js chỉ thử cổng kế tiếp khi
# `allowRetry && port && isDev && err.code === 'EADDRINUSE'`, mà `isDev` chỉ đúng ở
# đường chạy này. Chép nguyên chốt chặn của chay-app.ps1 sang đây là biến một đường
# chạy vốn LUÔN chạy được thành từ chối chạy, đúng vào tình huống run-dev.cmd sinh ra
# để phục vụ: mở bản dev bên cạnh bản production đang giữ cổng 3000. Người bấm đúp
# .cmd cũng không thêm được "-p 3001" nếu không mở cửa sổ dòng lệnh, còn dung-app.cmd
# thì tắt mất bản production đang dùng — hai lối gỡ đều không đi được.
#
# Vẫn bỏ qua hẳn kiểm tra khi người dùng tự chỉ định cổng khác: lúc đó cổng 3000 bị
# chiếm là chuyện bình thường, không có gì phải nói.
$tuChonCong = $false
foreach ($t in @($args)) {
    if ($t -eq "-p" -or $t -like "--port*") { $tuChonCong = $true }
}
if (-not $tuChonCong) {
    $busy = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    if ($busy) {
        $owner = Get-Process -Id $busy[0].OwningProcess -ErrorAction SilentlyContinue
        Write-Host ""
        Write-Host "Cổng 3000 đang bị chiếm bởi: $($owner.ProcessName) (PID $($busy[0].OwningProcess))" -ForegroundColor Yellow
        Write-Host "next dev sẽ tự chuyển sang cổng trống kế tiếp (3001...) — xem dòng địa chỉ nó in ra bên dưới." -ForegroundColor Yellow
        Write-Host "Có thể app đã chạy sẵn — nếu chỉ muốn dùng thì mở http://localhost:3000." -ForegroundColor DarkGray
        Write-Host "Muốn tắt tiến trình đang giữ cổng 3000: bấm đúp dung-app.cmd" -ForegroundColor DarkGray
        Write-Host ""
    }
}

# ─── Chạy ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Đang khởi động chế độ dev — mỗi trang biên dịch lần đầu sẽ chậm." -ForegroundColor Cyan
Write-Host "Đóng cửa sổ này hoặc bấm Ctrl+C để tắt app." -ForegroundColor DarkGray
Write-Host ""
if ($args.Count -gt 0) {
    & $nodeExe "node_modules\next\dist\bin\next" dev @args
} else {
    & $nodeExe "node_modules\next\dist\bin\next" dev
}
