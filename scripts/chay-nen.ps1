# Chạy Mercury Materials NGẦM — không cửa sổ, không ai phải bấm gì.
#
# Đây là việc mà Task Scheduler gọi mỗi lần đăng nhập Windows (đăng ký bằng
# scripts\tu-khoi-dong.ps1). File này cố ý chỉ là lớp vỏ mỏng quanh
# scripts\chay-app.ps1: mọi bước kiểm tra trước khi chạy — tìm Node, kiểm .env,
# bật hộ PostgreSQL, so mốc thời gian để biết có phải build lại không — nằm
# nguyên ở đó. Chép các bước ấy sang đây thì có hai bản sẽ lệch nhau theo thời
# gian, mà bản chạy ngầm đúng là bản không ai nhìn thấy lúc nó lệch.

param()

$ErrorActionPreference = "Stop"

# Giải mã đầu ra của tiến trình con theo UTF-8. Không có dòng này thì PowerShell
# đọc stdout của powershell con bằng bảng mã console cũ (CP437/CP850), trong khi
# con lại in ra UTF-8 — log sẽ đầy chữ như "khÃŸâ•—Æ’i â”€Ã¦ÃŸâ•—Ã–ng" và
# thành vô dụng đúng vào lúc cần đọc. Bọc try vì khi Task Scheduler chạy ngầm,
# tiến trình có thể không có console để đặt bảng mã.
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
$proj = Split-Path -Parent $PSScriptRoot

# Log để NGOÀI thư mục dự án, cạnh pgdata/pg-logs, vì hai lý do:
#  - Chạy ngầm mà không có log thì lúc app không lên chẳng còn gì để đọc.
#  - `chay-app.ps1` quyết định có build lại hay không bằng cách so mốc sửa đổi
#    của file trong app/, components/, lib/, prisma/, public/. Một file log đổi
#    liên tục mà rơi vào một trong các thư mục đó sẽ khiến nó tưởng mã nguồn
#    vừa sửa và build lại mỗi lần mở máy. Để hẳn ra ngoài thì không bao giờ
#    phải nhớ luật ấy — kể cả khi sau này có ai thêm thư mục vào danh sách.
$thuMucLog = Join-Path (Split-Path -Parent $proj) "app-logs"
if (-not (Test-Path $thuMucLog)) {
    New-Item -ItemType Directory -Path $thuMucLog -Force | Out-Null
}
$log = Join-Path $thuMucLog "app.log"

# Cắt log khi quá 5 MB, giữ lại đúng một đời trước. Không có bước này thì một
# lỗi lặp mỗi giây sẽ âm thầm ăn hết ổ đĩa — kiểu hỏng mà chạy ngầm hay gặp
# nhất, vì không ai ngồi nhìn nó lớn dần.
if ((Test-Path $log) -and ((Get-Item $log).Length -gt 5MB)) {
    Move-Item $log "$log.cu" -Force
}

# Mở log ở chế độ CHIA SẺ. Nếu chỉ dùng `Add-Content`, PowerShell giữ file ở
# chế độ độc quyền suốt thời gian app chạy — nghĩa là đúng lúc cần đọc log để
# xem vì sao app không lên thì lại không mở được file ra đọc. FileShare
# ReadWrite cho phép vừa ghi vừa có người khác đọc.
$fs = [System.IO.File]::Open($log, [System.IO.FileMode]::Append,
    [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
# Ghi KEM BOM khi file con trong. Windows PowerShell doc file khong BOM bang
# bang ma ANSI, nen ca log tieng Viet se hien ra "khá»Ÿi Ä‘á»™ng" — dung
# luc can doc nhat. StreamWriter chi ghi BOM khi stream dang o vi tri 0, nen
# lan ghi tiep vao file cu khong bi chen them BOM giua chung.
$ghi = New-Object System.IO.StreamWriter($fs, (New-Object System.Text.UTF8Encoding($true)))
$ghi.AutoFlush = $true   # không đệm: log phải đúng hiện tại, không phải đúng lúc app tắt

try {
    $ghi.WriteLine("")
    $ghi.WriteLine("=== $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss') — khởi động ngầm ===")

    # Gọi bằng một powershell CON chứ không dot-source: chay-app.ps1 kết thúc
    # bằng `next start` chạy mãi, và mọi dòng Next.js in ra cũng phải vào log.
    # Dot-source thì stdout của tiến trình node không đi qua đường ống này.
    & powershell -NoProfile -ExecutionPolicy Bypass `
        -File (Join-Path $PSScriptRoot "chay-app.ps1") -KhongMoTrinhDuyet *>&1 |
        ForEach-Object { $ghi.WriteLine($_.ToString()) }
}
finally {
    $ghi.Dispose()
    $fs.Dispose()
}
