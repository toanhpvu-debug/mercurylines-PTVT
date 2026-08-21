# Chạy Mercury Materials ở chế độ PRODUCTION — nhanh gấp ~17 lần chế độ development.
#
# Chỉ build lại khi mã nguồn thực sự thay đổi, nên:
#   - lần đầu (hoặc sau khi sửa code): build ~2 phút rồi chạy
#   - các lần sau: khởi động thẳng trong ~2 giây
#
# Dùng run-dev.cmd khi đang SỬA code (có hot-reload), dùng file này khi LÀM VIỆC.

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$proj = Split-Path -Parent $PSScriptRoot
Set-Location $proj

$nodeExe = "C:\Users\admin\AppData\Local\ms-playwright-go\1.57.0\node.exe"
if (-not (Test-Path $nodeExe)) { $nodeExe = "node" }
$nextBin = "node_modules\next\dist\bin\next"

Write-Host ""
Write-Host "=== MERCURY MATERIALS (production) ===" -ForegroundColor Cyan

# --- Có cần build lại không? ---
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
    & $nodeExe $nextBin build
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "BUILD THẤT BẠI — chưa chạy được. Xem lỗi ở trên." -ForegroundColor Red
        return
    }
    Write-Host ("Build xong sau {0:N0} giây." -f $sw.Elapsed.TotalSeconds) -ForegroundColor Green
}

Write-Host ""
Write-Host "Đang khởi động..." -ForegroundColor Cyan
Write-Host "Mở trình duyệt tại http://localhost:3000" -ForegroundColor Green
Write-Host "Đóng cửa sổ này (hoặc Ctrl+C) để tắt app." -ForegroundColor DarkGray
Write-Host ""
& $nodeExe $nextBin start
