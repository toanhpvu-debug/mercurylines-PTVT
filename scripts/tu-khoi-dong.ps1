# Bật / tắt chế độ TỰ CHẠY: đăng nhập Windows là app có sẵn, không phải mở cmd.
#
#   powershell -File scripts\tu-khoi-dong.ps1 -ViecCanLam bat
#   powershell -File scripts\tu-khoi-dong.ps1 -ViecCanLam tat
#   powershell -File scripts\tu-khoi-dong.ps1 -ViecCanLam trang-thai
#
# Dùng Task Scheduler chứ không dùng thư mục Startup: thư mục Startup luôn bung
# một cửa sổ console không giấu được, mà giấu được thì cũng không đặt được giới
# hạn thời gian chạy hay quy tắc chạy khi dùng pin. Cũng KHÔNG dựng Windows
# service (NSSM và tương tự): service cần quyền quản trị, mà cả bản PostgreSQL
# của dự án này cũng cố ý chạy trong quyền người dùng thường — thêm một thứ đòi
# quyền quản trị là hỏng đúng nguyên tắc đã chọn cho cả bản cài.

param(
    [ValidateSet("bat", "tat", "trang-thai")]
    [string]$ViecCanLam = "bat"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$proj = Split-Path -Parent $PSScriptRoot
$TEN_VIEC = "MercuryMaterials"
$kichBan = Join-Path $PSScriptRoot "chay-nen.ps1"
$loiTat = Join-Path ([Environment]::GetFolderPath("Desktop")) "Mercury Materials.url"

function Viec { Get-ScheduledTask -TaskName $TEN_VIEC -ErrorAction SilentlyContinue }

function CongDangNghe {
    [bool](Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
}

Write-Host ""
Write-Host "=== MERCURY MATERIALS — TỰ CHẠY KHI MỞ MÁY ===" -ForegroundColor Cyan
Write-Host ""

switch ($ViecCanLam) {

"bat" {
    if (-not (Test-Path $kichBan)) {
        Write-Host "Thiếu $kichBan — không bật được." -ForegroundColor Red
        return
    }

    $hanhDong = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $kichBan + '"') `
        -WorkingDirectory $proj

    # Chạy khi ĐĂNG NHẬP, không phải khi khởi động máy: chạy lúc khởi động thì
    # phải là tài khoản hệ thống, tức cần quyền quản trị và phải cất mật khẩu.
    $moc = New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
    # Chờ 20 giây sau khi đăng nhập rồi mới chạy. Lúc vừa đăng nhập, ổ đĩa và
    # mạng còn đang bận hàng chục thứ khác; PostgreSQL bật vào đúng lúc ấy sẽ
    # chậm và dễ hỏng hơn hẳn.
    $moc.Delay = "PT20S"

    $chuThe = New-ScheduledTaskPrincipal `
        -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
        -LogonType Interactive -RunLevel Limited

    $caiDat = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
        -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero)
    # ExecutionTimeLimit mặc định của Windows là 3 NGÀY: quá hạn thì Task
    # Scheduler tự giết tiến trình. Với một web server chạy liên tục thì đó là
    # "cứ ba ngày app tự tắt một lần" — kiểu lỗi rất khó lần ra vì nó không để
    # lại lỗi nào trong log của app. [TimeSpan]::Zero nghĩa là không giới hạn.
    # MultipleInstances IgnoreNew: khóa màn hình rồi đăng nhập lại không dựng
    # thêm một bản thứ hai tranh cổng 3000 với bản đang chạy.

    Register-ScheduledTask -TaskName $TEN_VIEC -Action $hanhDong -Trigger $moc `
        -Principal $chuThe -Settings $caiDat `
        -Description "Chay Mercury Materials ngam khi dang nhap Windows." -Force | Out-Null

    Write-Host "Đã bật tự chạy (việc '$TEN_VIEC' trong Task Scheduler)." -ForegroundColor Green

    # Lối tắt ngoài Desktop: chạy ngầm thì không còn cửa sổ nào để bấm, nên phải
    # có một chỗ hữu hình để mở app.
    "[InternetShortcut]`r`nURL=http://localhost:3000`r`nIconIndex=0" |
        Set-Content -Path $loiTat -Encoding ASCII
    Write-Host "Đã tạo lối tắt 'Mercury Materials' ngoài Desktop." -ForegroundColor Green

    if (CongDangNghe) {
        Write-Host "App đang chạy sẵn — không cần bật lại." -ForegroundColor DarkGray
    } else {
        Write-Host ""
        Write-Host "Đang bật app ngay bây giờ (không cần chờ khởi động lại máy)..." -ForegroundColor Cyan
        Start-ScheduledTask -TaskName $TEN_VIEC
        for ($i = 0; $i -lt 180; $i++) {
            Start-Sleep -Milliseconds 1000
            if (CongDangNghe) { break }
        }
        if (CongDangNghe) {
            Write-Host "App đã chạy sau $($i + 1) giây." -ForegroundColor Green
        } else {
            Write-Host "App chưa lên sau 3 phút — xem log ở ..\app-logs\app.log" -ForegroundColor Yellow
        }
    }

    Write-Host ""
    Write-Host "Từ giờ: mở máy, đăng nhập Windows, bấm lối tắt ngoài Desktop." -ForegroundColor Cyan
    Write-Host "Muốn tắt chế độ này: bấm đúp tat-tu-khoi-dong.cmd" -ForegroundColor DarkGray
    Write-Host ""
}

"tat" {
    if (Viec) {
        Unregister-ScheduledTask -TaskName $TEN_VIEC -Confirm:$false
        Write-Host "Đã tắt tự chạy — lần sau mở máy app sẽ KHÔNG tự lên." -ForegroundColor Green
    } else {
        Write-Host "Vốn chưa bật tự chạy — không có gì để tắt." -ForegroundColor DarkGray
    }
    if (Test-Path $loiTat) {
        Remove-Item $loiTat -Force
        Write-Host "Đã xóa lối tắt ngoài Desktop." -ForegroundColor Green
    }
    # Cố ý KHÔNG tắt app đang chạy: người ta tắt chế độ tự khởi động thường là
    # để đổi cách chạy, không phải để mất app ngay giữa buổi làm việc.
    if (CongDangNghe) {
        Write-Host "App vẫn đang chạy — muốn tắt hẳn thì bấm đúp dung-app.cmd." -ForegroundColor DarkGray
    }
    Write-Host ""
}

"trang-thai" {
    $v = Viec
    if ($v) {
        $tt = Get-ScheduledTaskInfo -TaskName $TEN_VIEC
        Write-Host "Tự chạy      : ĐANG BẬT ($($v.State))" -ForegroundColor Green
        # Dịch mã kết quả của Task Scheduler. Để nguyên số thì "267009" trông
        # y như một mã lỗi, trong khi nó chỉ có nghĩa là việc đang chạy.
        $ma = $tt.LastTaskResult
        $ngh = switch ($ma) {
            0       { "xong, không lỗi" }
            267009  { "đang chạy" }
            267011  { "chưa chạy lần nào" }
            267014  { "bị dừng giữa chừng" }
            default { "mã 0x" + $ma.ToString("X") }
        }
        Write-Host "Chạy lần cuối: $($tt.LastRunTime) — $ngh"
    } else {
        Write-Host "Tự chạy      : chưa bật" -ForegroundColor Yellow
    }
    if (CongDangNghe) {
        $c = Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -First 1
        Write-Host "App          : đang chạy (PID $($c.OwningProcess)) — http://localhost:3000" -ForegroundColor Green
    } else {
        Write-Host "App          : không chạy" -ForegroundColor Yellow
    }
    Write-Host "Lối tắt      : $(if (Test-Path $loiTat) { 'có ngoài Desktop' } else { 'chưa có' })"
    Write-Host "Log          : $(Join-Path (Split-Path -Parent $proj) 'app-logs\app.log')"
    Write-Host ""
}

}
