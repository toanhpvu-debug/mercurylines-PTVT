# Tắt Mercury Materials đang chạy ở cổng 3000.
#
# Dùng khi cửa sổ chạy app bị mất/thu nhỏ không tìm thấy, hoặc app còn chạy ngầm
# từ lần trước làm cổng 3000 bị chiếm.

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "=== TẮT MERCURY MATERIALS ===" -ForegroundColor Cyan

$conns = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (-not $conns) {
    Write-Host "Cổng 3000 đang trống — app không chạy." -ForegroundColor Green
    Write-Host ""
    return
}

# Đặt cờ "dừng chủ ý" TRƯỚC khi tắt node: chay-app.ps1 chạy server trong vòng
# tự-chạy-lại (xem cuối file đó). Không có cờ này thì tắt xong 5 giây nó lại
# lên, và người dùng tưởng dung-app.cmd hỏng. Cờ nằm cạnh app.log, ngoài thư
# mục dự án, cùng lý do với log (xem chay-nen.ps1).
$thuMucLog = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) "app-logs"
New-Item -ItemType Directory -Path $thuMucLog -Force | Out-Null
Set-Content -Path (Join-Path $thuMucLog "dung.flag") -Value (Get-Date -Format s) -Encoding ASCII

$pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($processId in $pids) {
    $p = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if (-not $p) { continue }
    # Chỉ tắt tiến trình node — tránh tắt nhầm thứ khác đang dùng cổng 3000.
    if ($p.ProcessName -ne "node") {
        Write-Host "Cổng 3000 do '$($p.ProcessName)' (PID $processId) giữ — KHÔNG phải app này, không tắt." -ForegroundColor Yellow
        continue
    }
    try {
        Stop-Process -Id $processId -Force -ErrorAction Stop
        Write-Host "Đã tắt node (PID $processId)." -ForegroundColor Green
    } catch {
        Write-Host "Không tắt được PID ${processId}: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Start-Sleep -Milliseconds 700
if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "Cổng 3000 vẫn bị chiếm." -ForegroundColor Yellow
} else {
    Write-Host "Cổng 3000 đã trống. Bấm đúp chay-app.cmd để chạy lại." -ForegroundColor Green
}
Write-Host ""
