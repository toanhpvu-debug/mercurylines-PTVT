<#
    Bat / tat ban PostgreSQL RIENG cua du an (khong phai Windows service).

    Vi sao co file nay: may nay khong cai PostgreSQL vao Program Files (viec do
    can quyen quan tri). Thay vao do, ban binaries chinh thuc duoc giai nen ra
    thu muc canh du an va chay bang chinh tai khoan dang dung:

        D:\mercurylines code\pgsql     <- chuong trinh
        D:\mercurylines code\pgdata    <- du lieu that

    Doi lai: PostgreSQL khong tu bat cung Windows. File nay lo viec bat/tat do.
    Binh thuong khong can chay tay — chay-app.cmd tu goi no.

    Cach dung:
        postgres-rieng.ps1 -ViecCanLam chay        # bat
        postgres-rieng.ps1 -ViecCanLam dung        # tat
        postgres-rieng.ps1 -ViecCanLam trang-thai  # xem dang chay khong
#>
[CmdletBinding()]
param(
    [ValidateSet("chay", "dung", "trang-thai")]
    [string]$ViecCanLam = "chay",
    # 60 x 500ms = 30 giay. Bat nguoi sau khi tat dot ngot phai chay phuc hoi
    # va fsync ca thu muc du lieu, cham hon han lan tat dung cach (~2 giay).
    [int]$CongCho = 60
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [Console]::OutputEncoding = [Text.Encoding]::UTF8

$proj = Split-Path -Parent $PSScriptRoot
$cha  = Split-Path -Parent $proj

function Tim-ThuMuc([string[]]$ungVien) {
    foreach ($d in $ungVien) {
        if ($d -and (Test-Path $d)) { return (Resolve-Path $d).Path }
    }
    return $null
}

$pgsql = Tim-ThuMuc @(
    (Join-Path $cha "pgsql"),
    (Join-Path $proj "pgsql"),
    "D:\mercurylines code\pgsql"
)
$pgdata = Tim-ThuMuc @(
    (Join-Path $cha "pgdata"),
    (Join-Path $proj "pgdata"),
    "D:\mercurylines code\pgdata"
)

$pgIsReady = $null
if ($pgsql) {
    $ung = Join-Path $pgsql "bin\pg_isready.exe"
    if (Test-Path $ung) { $pgIsReady = $ung }
}

function Dang-Chay {
    # Hoi thang may chu chu khong chi nhin cong. Cong 5432 co the con o trang
    # thai Listen mot luc sau khi tien trinh chet dot ngot — luc do kiem tra
    # bang cong se bao nham "dang chay" va script bo qua buoc bat lai.
    if ($pgIsReady) {
        & $pgIsReady -h 127.0.0.1 -p 5432 -q 2>$null | Out-Null
        return ($LASTEXITCODE -eq 0)
    }
    $c = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue
    return [bool]$c
}

function Chay-PgCtl([string[]]$thamSo) {
    # Phai chuyen huong stdout/stderr ra file: neu de mac dinh, tien trinh con
    # thua ke chinh console cua cua so nay, nen (a) duong ong cua nguoi goi
    # khong bao gio dong, (b) dong cua so se ban tin hieu tat den ca database.
    $ra  = Join-Path $env:TEMP "pg_ctl-ra.txt"
    $loi = Join-Path $env:TEMP "pg_ctl-loi.txt"
    Start-Process -FilePath $pgCtl -ArgumentList $thamSo -NoNewWindow -Wait `
                  -RedirectStandardOutput $ra -RedirectStandardError $loi
    foreach ($f in @($ra, $loi)) {
        if (Test-Path $f) {
            Get-Content $f | Where-Object { $_.Trim() -ne "" } | ForEach-Object { Write-Host "  $_" }
            Remove-Item $f -Force -ErrorAction SilentlyContinue
        }
    }
}

function Bat-PgCtl([string[]]$thamSo) {
    # KHONG dung -Wait o day. Start-Process -Wait cua PowerShell cho ca cay tien
    # trinh con, ma pg_ctl start de lai postmaster chay mai — nen -Wait se treo
    # vinh vien, cua so bao "Dang bat..." roi dung im.
    # Cung KHONG dung -NoNewWindow / -Redirect*: hai tuy chon do bat PowerShell
    # dung UseShellExecute=false, tien trinh con thua ke console cua cua so nay,
    # dong cua so la ban tin hieu tat den ca database. De mac dinh thi
    # ShellExecute cap cho no mot console rieng, database song doc lap.
    # Nhat ky may chu da duoc pg_ctl ghi qua tham so -l nen khong mat gi.
    Start-Process -FilePath $pgCtl -ArgumentList $thamSo -WindowStyle Hidden
}

if ($ViecCanLam -eq "trang-thai") {
    if (Dang-Chay) {
        Write-Host "PostgreSQL dang chay o cong 5432." -ForegroundColor Green
    } else {
        Write-Host "PostgreSQL KHONG chay." -ForegroundColor Yellow
    }
    return
}

if (-not $pgsql -or -not $pgdata) {
    Write-Host ""
    Write-Host "Khong tim thay ban PostgreSQL rieng cua du an." -ForegroundColor Red
    Write-Host "  Cho chuong trinh : $(Join-Path $cha 'pgsql')"
    Write-Host "  Cho du lieu      : $(Join-Path $cha 'pgdata')"
    Write-Host ""
    Write-Host "Neu may nay dung PostgreSQL cai san (Windows service) thi bo qua"
    Write-Host "file nay va dung:  Start-Service postgresql-x64-17"
    exit 1
}

$pgCtl = Join-Path $pgsql "bin\pg_ctl.exe"
# Nhat ky KHONG duoc nam trong pgdata. Sau moi lan tat dot ngot, PostgreSQL
# fsync ca thu muc du lieu luc khoi dong; gap chinh file log dang bi mo de ghi
# thi bao "sharing violation" roi thu lai 30 giay — moi lan bat cham them nua
# phut ma khong ai hieu vi sao.
$thuMucLog = Join-Path $cha "pg-logs"
if (-not (Test-Path $thuMucLog)) { New-Item -ItemType Directory -Path $thuMucLog | Out-Null }
$log   = Join-Path $thuMucLog "postgres.log"

if ($ViecCanLam -eq "dung") {
    if (-not (Dang-Chay)) {
        Write-Host "PostgreSQL von khong chay." -ForegroundColor Yellow
        return
    }
    # -m fast: dong ket noi dang mo roi tat ngay, khong cho tung phien thoat.
    Chay-PgCtl @("-D", "`"$pgdata`"", "-m", "fast", "stop")
    Write-Host "Da tat PostgreSQL." -ForegroundColor Green
    return
}

# --- chay -------------------------------------------------------------------
if (Dang-Chay) {
    Write-Host "PostgreSQL da chay san o cong 5432." -ForegroundColor Green
    return
}

Write-Host "Dang bat PostgreSQL..." -ForegroundColor Cyan
Bat-PgCtl @("-D", "`"$pgdata`"", "-l", "`"$log`"", "-o", "`"-p 5432`"", "start")

for ($i = 0; $i -lt $CongCho; $i++) {
    if (Dang-Chay) {
        Write-Host "PostgreSQL da san sang (cong 5432)." -ForegroundColor Green
        return
    }
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "Bat khong len sau $([math]::Round($CongCho * 0.5)) giay." -ForegroundColor Red
Write-Host "Xem chi tiet trong: $log"
if (Test-Path $log) {
    Write-Host "--- 15 dong cuoi ---"
    Get-Content $log -Tail 15
}
exit 1
