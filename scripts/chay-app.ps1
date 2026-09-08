# Chạy Mercury Materials ở chế độ PRODUCTION — nhanh gấp ~50 lần chế độ development.
#
# Chỉ build lại khi mã nguồn thực sự thay đổi:
#   - lần đầu (hoặc sau khi sửa code): build ~2 phút rồi chạy
#   - các lần sau: khởi động thẳng trong ~2 giây
#
# Dùng run-dev.cmd khi đang SỬA code (có hot-reload), dùng file này khi LÀM VIỆC.

param(
    # Chạy ngầm (chay-nen.ps1 gọi vào): không mở trình duyệt. Khi Windows
    # tự chạy app lúc đăng nhập, bung sẵn một cửa sổ trình duyệt là quấy
    # rầy — người dùng bấm lối tắt ngoài Desktop khi nào cần.
    [switch]$KhongMoTrinhDuyet
)

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
Write-Host "=== MERCURY MATERIALS (production) ===" -ForegroundColor Cyan

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
    Loi "Thiếu file .env (chứa SESSION_SECRET và thông tin công ty).`nChép từ .env.example rồi điền giá trị."
    return
}
# Database nay la PostgreSQL chu khong con la file prisma\dev.db — kiem tra
# xem MAY CHU co tra loi khong. Kiem tra file cu vua bo sot may chu tat (app
# van chay roi moi trang deu bao loi), vua chan oan may moi cai dung (khong co
# dev.db thi tu choi chay du PostgreSQL van tot).
. (Join-Path $PSScriptRoot "lib-postgres.ps1")
try {
    $kn = Doc-KetNoi -DuAn $proj
} catch {
    Loi "Không đọc được DATABASE_URL trong .env.`n$($_.Exception.Message)"
    return
}
$tcp = New-Object System.Net.Sockets.TcpClient
try {
    $noi = $tcp.BeginConnect($kn.May, [int]$kn.Cong, $null, $null)
    $kip = $noi.AsyncWaitHandle.WaitOne(3000, $false) -and $tcp.Connected
} catch {
    $kip = $false
} finally {
    $tcp.Close()
}
# Ban PostgreSQL rieng cua du an (pgsql/pgdata canh thu muc du an) khong phai
# Windows service nen khong tu bat sau khi khoi dong may. Thu bat ho truoc khi
# tu choi chay, de nguoi dung khong phai nho them mot buoc thu cong.
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

# ─── Cổng 3000 có đang bị chiếm không ────────────────────────────────────────
$busy = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    $owner = Get-Process -Id $busy[0].OwningProcess -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "Cổng 3000 đang bị chiếm bởi: $($owner.ProcessName) (PID $($busy[0].OwningProcess))" -ForegroundColor Yellow
    Write-Host "Có thể app đã chạy sẵn — thử mở http://localhost:3000 trước." -ForegroundColor Yellow
    Write-Host "Muốn tắt tiến trình đó để chạy lại: bấm đúp dung-app.cmd" -ForegroundColor Yellow
    Write-Host ""
    return
}

# Đường dẫn tới bộ chạy của Next, dùng cho cả bước build lẫn bước chạy.
$duongDanNext = Join-Path $proj "node_modules\next\dist\bin\next"

# ─── Có cần build lại không? ─────────────────────────────────────────────────
# So mốc thời gian của bản build với file mã nguồn mới nhất.
$buildId = Join-Path $proj ".next\BUILD_ID"
$needBuild = $true
if (Test-Path $buildId) {
    $builtAt = (Get-Item $buildId).LastWriteTime
    $srcDirs = @("app", "components", "lib", "prisma", "public") |
        ForEach-Object { Join-Path $proj $_ } | Where-Object { Test-Path $_ }
    $newest = Get-ChildItem $srcDirs -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -in ".ts", ".tsx", ".css", ".prisma", ".mjs", ".json" } |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    # Đổi cấu hình gốc cũng phải build lại.
    $configs = @("next.config.ts", "postcss.config.mjs", "package.json") |
        ForEach-Object { Join-Path $proj $_ } | Where-Object { Test-Path $_ } |
        ForEach-Object { Get-Item $_ } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $newestSrc = @($newest, $configs) | Where-Object { $_ } |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($newestSrc -and $newestSrc.LastWriteTime -le $builtAt) {
        $needBuild = $false
        Write-Host "Bản build còn mới (mã nguồn không đổi từ $($builtAt.ToString('dd/MM HH:mm'))) — bỏ qua bước build." -ForegroundColor DarkGray
    } else {
        Write-Host "Mã nguồn đã đổi kể từ lần build trước — cần build lại." -ForegroundColor Yellow
    }
} else {
    Write-Host "Chưa có bản build nào — build lần đầu." -ForegroundColor Yellow
}

if ($needBuild) {
    Write-Host "Đang build, mất khoảng 2 phút. Lần sau nếu không sửa code sẽ bỏ qua bước này." -ForegroundColor Yellow
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    # Chạy `next build` với ErrorActionPreference = Continue, và ép mọi dòng ra
    # thành chuỗi trước khi đi tiếp.
    #
    # Vì sao phải làm vậy: khi file này được gọi ở chế độ NGẦM
    # (scripts\chay-nen.ps1), stderr của nó là một đường ống chứ không phải cửa
    # sổ console. Trong Windows PowerShell 5.1, mỗi dòng mà tiến trình node in
    # ra stderr lúc đó bị bọc thành ErrorRecord — và với "Stop" ở đầu file,
    # ErrorRecord đầu tiên là lỗi CHẾT NGƯỜI: script dừng ngay giữa bước build.
    # Triệu chứng đúng như đã gặp: log dừng ở "Finalizing page optimization",
    # việc trong Task Scheduler trả về 1, mà không có lấy một dòng lỗi để lần
    # ra. `next build` in tiến độ ra stderr là chuyện bình thường, không phải
    # lỗi — chỉ mã thoát khác 0 mới là hỏng.
    $eapCu = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $nodeExe $duongDanNext build 2>&1 | ForEach-Object { "$_" }
    $maThoat = $LASTEXITCODE
    $ErrorActionPreference = $eapCu
    if ($maThoat -ne 0) {
        # Xoa BUILD_ID de lan sau BUOC PHAI build lai.
        #
        # `next build` ghi BUILD_ID tu giua chung, truoc khi xong han. Build
        # hong ma de nguyen file do thi buoc so moc thoi gian o tren se thay
        # "ban build con moi" va chay thang server bang mot ban build do dang —
        # app len binh thuong, chi mot vai trang la hong, va khong con dau vet
        # nao chi ve lan build that bai.
        Remove-Item (Join-Path $proj ".next\BUILD_ID") -Force -ErrorAction SilentlyContinue
        Loi "Build thất bại — xem lỗi ở trên. Lan chay sau se tu build lai."
        return
    }
    Write-Host ("Build xong sau {0:N0} giây." -f $sw.Elapsed.TotalSeconds) -ForegroundColor Green
}

# ─── Chạy, và tự mở trình duyệt khi server sẵn sàng ──────────────────────────
Write-Host ""
Write-Host "Đang khởi động..." -ForegroundColor Cyan

if (-not $KhongMoTrinhDuyet) {
    # Job phụ: chờ server trả lời rồi mở trình duyệt, để không chặn tiến trình chính.
    Start-Job -ScriptBlock {
        for ($i = 0; $i -lt 120; $i++) {
            try {
                Invoke-WebRequest "http://localhost:3000/login" -UseBasicParsing -TimeoutSec 2 | Out-Null
                Start-Process "http://localhost:3000"
                break
            } catch { Start-Sleep -Milliseconds 400 }
        }
    } | Out-Null

    Write-Host "App chạy tại http://localhost:3000 (trình duyệt sẽ tự mở)" -ForegroundColor Green
    Write-Host "Đóng cửa sổ này hoặc bấm Ctrl+C để tắt app." -ForegroundColor DarkGray
} else {
    Write-Host "App chạy tại http://localhost:3000 (chế độ ngầm)" -ForegroundColor Green
}
Write-Host ""
# Cùng lý do như bước build ở trên: chạy ngầm thì stderr là đường ống, mỗi dòng
# node in ra đó sẽ thành ErrorRecord và giết server ngay lần cảnh báo đầu tiên.
$ErrorActionPreference = "Continue"
& $nodeExe $duongDanNext start 2>&1 | ForEach-Object { "$_" }
