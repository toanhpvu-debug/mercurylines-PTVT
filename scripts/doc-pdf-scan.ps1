# Đọc chữ từ file PDF — kể cả PDF SCAN (ảnh chụp, không có lớp chữ).
#
# Máy này không có thư viện đọc PDF, không có Tesseract và không cài thêm được
# (không có npm, không có pip cho các gói này). Nhưng Windows có sẵn hai thứ
# vừa đủ để làm việc đó:
#   - Windows.Data.Pdf.PdfDocument   : dựng từng trang PDF thành ảnh
#   - Windows.Media.Ocr.OcrEngine    : nhận dạng chữ trong ảnh
# Cả hai nằm trong hệ điều hành, không phải cài gì.
#
# Dùng:  doc-pdf-scan.ps1 -File <đường dẫn .pdf> [-MaxPages 3] [-Scale 2]
# In ra: text thuần trên stdout. Lỗi thì in ra stderr và thoát khác 0.
#
# Kết quả OCR KHÔNG bao giờ được ghi thẳng vào dữ liệu — chỉ dùng để điền sẵn
# rồi người nhập đối chiếu với bản gốc. Đọc nhầm một chữ số của khối lượng dầu
# là sai cả bảng cân đối nhiên liệu.

param(
    [Parameter(Mandatory = $true)][string]$File,
    [int]$MaxPages = 3,
    # Phóng to trước khi OCR — chữ nhỏ trên bản scan 150 dpi nhận dạng rất tệ
    # nếu để nguyên kích thước.
    [double]$Scale = 2.0
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if (-not (Test-Path $File)) {
    Write-Error "Không thấy file: $File"
    exit 1
}

Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null

# WinRT trả về IAsyncOperation, PowerShell 5.1 không await được thẳng — phải
# lấy phương thức AsTask qua reflection rồi chờ Task.
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
        $_.Name -eq 'AsTask' -and
        $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]

function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

$asTaskAction = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
        $_.Name -eq 'AsTask' -and
        $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'
    })[0]

function AwaitAction($WinRtAction) {
    $netTask = $asTaskAction.Invoke($null, @($WinRtAction))
    $netTask.Wait(-1) | Out-Null
}

# Nạp kiểu WinRT.
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $engine) {
    # Không có gói ngôn ngữ theo hồ sơ người dùng thì lấy tiếng Anh — chứng từ
    # dầu (BDN) gần như luôn bằng tiếng Anh.
    $en = [Windows.Globalization.Language]::new("en-US")
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($en)
}
if (-not $engine) {
    Write-Error "Windows chưa có gói nhận dạng chữ (OCR) nào. Vào Settings > Time & Language > Language, thêm gói tiếng Anh có phần OCR."
    exit 2
}

$full = (Resolve-Path $File).Path
$storage = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($full)) ([Windows.Storage.StorageFile])
$doc = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($storage)) ([Windows.Data.Pdf.PdfDocument])

$soTrang = [Math]::Min($doc.PageCount, $MaxPages)
$ra = New-Object System.Text.StringBuilder

for ($i = 0; $i -lt $soTrang; $i++) {
    $page = $doc.GetPage([uint32]$i)
    $stream = [Windows.Storage.Streams.InMemoryRandomAccessStream]::new()

    $opt = [Windows.Data.Pdf.PdfPageRenderOptions]::new()
    $opt.DestinationWidth = [uint32]([Math]::Round($page.Size.Width * $Scale))
    AwaitAction ($page.RenderToStreamAsync($stream, $opt))

    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

    $kq = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

    [void]$ra.AppendLine("--- TRANG $($i + 1) ---")
    # Ghi theo TỪNG DÒNG như bản gốc, không gộp cả trang thành một khối: bảng
    # trong chứng từ chỉ đọc được khi còn giữ cấu trúc dòng.
    foreach ($line in $kq.Lines) {
        [void]$ra.AppendLine($line.Text)
    }
    $bitmap.Dispose()
    $stream.Dispose()
    $page.Dispose()
}

if ($doc.PageCount -gt $soTrang) {
    [void]$ra.AppendLine("--- (còn $($doc.PageCount - $soTrang) trang chưa đọc) ---")
}

Write-Output $ra.ToString()
