# Chạy Mercury Materials ở chế độ PRODUCTION — nhanh gấp ~50 lần chế độ development.
#
# Chỉ build lại khi mã nguồn thực sự thay đổi:
#   - lần đầu (hoặc sau khi sửa code): build ~2 phút rồi chạy
#   - các lần sau: khởi động thẳng trong ~2 giây
#
# Dùng run-dev.cmd khi đang SỬA code (có hot-reload), dùng file này khi LÀM VIỆC.

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
$dbFile = Join-Path $proj "prisma\dev.db"
if (-not (Test-Path $dbFile)) {
    Loi "Thiếu database prisma\dev.db.`nKhôi phục từ bản sao lưu trong E:\backup-mercury, hoặc tạo mới bằng: npx prisma migrate deploy"
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
    & $nodeExe "node_modules\next\dist\bin\next" build
    if ($LASTEXITCODE -ne 0) {
        Loi "Build thất bại — xem lỗi ở trên."
        return
    }
    Write-Host ("Build xong sau {0:N0} giây." -f $sw.Elapsed.TotalSeconds) -ForegroundColor Green
}

# ─── Chạy, và tự mở trình duyệt khi server sẵn sàng ──────────────────────────
Write-Host ""
Write-Host "Đang khởi động..." -ForegroundColor Cyan

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
Write-Host ""
& $nodeExe "node_modules\next\dist\bin\next" start
