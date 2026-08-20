# Đẩy các thay đổi mã nguồn lên GitHub: add → commit → push.
#
# Chỉ đụng tới MÃ NGUỒN. Dữ liệu (prisma\dev.db, uploads\, .env, templates\*.xlsx)
# nằm trong .gitignore nên không bao giờ lên GitHub — sao lưu chúng bằng sao-luu-du-lieu.cmd.

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

$proj = Split-Path -Parent $PSScriptRoot
Set-Location $proj

Write-Host ""
Write-Host "=== ĐỒNG BỘ MÃ NGUỒN LÊN GITHUB ===" -ForegroundColor Cyan
$remote = git remote get-url origin 2>$null
Write-Host "Repo: $remote"
Write-Host ""

# --- Xem có gì thay đổi không ---
$changes = git status --short
if (-not $changes) {
    Write-Host "Không có thay đổi nào. Mã nguồn trên máy đã khớp với lần commit gần nhất." -ForegroundColor Green
    # Vẫn có thể còn commit chưa đẩy lên từ lần trước.
    $ahead = git rev-list --count "@{u}..HEAD" 2>$null
    if ($ahead -and [int]$ahead -gt 0) {
        Write-Host "Nhưng còn $ahead commit chưa đẩy lên GitHub. Đang đẩy..." -ForegroundColor Yellow
        git push
        if ($LASTEXITCODE -eq 0) { Write-Host "Đã đẩy xong." -ForegroundColor Green }
        else { Write-Host "Đẩy thất bại (mã lỗi $LASTEXITCODE)." -ForegroundColor Red }
    }
    Write-Host ""
    return
}

Write-Host "Các file đã thay đổi:" -ForegroundColor Yellow
git status --short
Write-Host ""

# --- Nhập mô tả ---
Write-Host "Mô tả ngắn việc bạn vừa làm (ví dụ: them cot gia vao bang ton kho)."
Write-Host "Bỏ trống rồi Enter thì dùng mô tả mặc định kèm ngày giờ."
$msg = Read-Host "Mô tả"
if ([string]::IsNullOrWhiteSpace($msg)) {
    $msg = "Cap nhat ma nguon " + (Get-Date -Format "yyyy-MM-dd HH:mm")
}

# --- add + commit + push ---
Write-Host ""
git add -A
git commit -m $msg
if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit thất bại. Dừng lại, chưa đẩy gì lên GitHub." -ForegroundColor Red
    Write-Host ""
    return
}

Write-Host ""
Write-Host "Đang đẩy lên GitHub..." -ForegroundColor Cyan
git push
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "XONG. Đã cập nhật lên GitHub." -ForegroundColor Green
    if ($remote) { Write-Host ($remote -replace '\.git$', '') -ForegroundColor DarkGray }
} else {
    Write-Host ""
    Write-Host "Đẩy thất bại (mã lỗi $LASTEXITCODE)." -ForegroundColor Red
    Write-Host "Commit đã lưu trên máy — sửa xong lỗi rồi chạy lại script này là đẩy tiếp được." -ForegroundColor Yellow
}
Write-Host ""
