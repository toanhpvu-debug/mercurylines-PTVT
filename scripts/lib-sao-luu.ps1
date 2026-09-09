# Tìm chỗ để bản sao lưu.
#
# Trước đây hai script sao lưu / khôi phục ghim cứng "E:\backup-mercury". Máy
# nào không có ổ E: thì `New-Item` ném lỗi ngay ở bước nén, tức là SAO LƯU
# CHƯA BAO GIỜ CHẠY trên máy đó — mà lỗi chỉ lộ ra đúng lúc người ta cần bản
# sao lưu nhất.
#
# Hai điều dễ làm sai khi tự chọn chỗ, và cách xử ở đây:
#
#   1. "Ổ khác chữ cái" KHÔNG có nghĩa là "đĩa khác". Trên chính máy này C: và
#      D: là hai phân vùng của CÙNG một ổ NVMe; chép từ D: sang C: thì hỏng ổ
#      là mất cả dữ liệu lẫn bản sao lưu. Nên ở đây so theo SỐ ĐĨA VẬT LÝ, và
#      chỉ coi là an toàn khi khác đĩa.
#   2. Thư mục gốc của ổ hệ thống (C:\) thường KHÔNG ghi được nếu không chạy
#      quyền quản trị. Chọn xong mà không ghi thử thì tới lúc nén mới báo
#      "Access denied". Nên mỗi ứng viên đều được ghi thử một tệp rỗng.
#
# Thứ tự tìm, dừng ở cái đầu tiên hợp lệ:
#   1. Biến môi trường BACKUP_DIR — người vận hành chỉ định thẳng.
#   2. BACKUP_DIR trong .env của dự án.
#   3. Ổ nào ĐÃ CÓ sẵn thư mục backup-mercury (giữ đúng chỗ đang dùng, kể cả
#      khi ổ đổi chữ cái sau lần cắm khác).
#   4. Ổ nằm trên ĐĨA VẬT LÝ KHÁC, ghi được: ổ rời trước, rồi ổ trống nhiều nhất.
#   5. Ổ khác chữ cái nhưng cùng đĩa, ghi được — vẫn dùng được nhưng cảnh báo.
#   6. Cạnh thư mục dự án — cảnh báo.

function Doc-BackupDirTuEnv {
    param([Parameter(Mandatory)][string]$DuAn)
    $fileEnv = Join-Path $DuAn ".env"
    if (-not (Test-Path $fileEnv)) { return $null }
    foreach ($dong in Get-Content $fileEnv) {
        if ($dong -match '^\s*BACKUP_DIR\s*=\s*"?([^"#]+?)"?\s*$') {
            return $Matches[1].Trim()
        }
    }
    return $null
}

# Chữ cái ổ -> số đĩa vật lý. Trả $null khi không hỏi được (máy ảo, thiếu quyền).
function Lay-BanDoDia {
    $bando = @{}
    try {
        foreach ($p in Get-Partition -ErrorAction Stop) {
            if ($p.DriveLetter) { $bando[[string]$p.DriveLetter] = $p.DiskNumber }
        }
    } catch {
        return $null
    }
    return $bando
}

# Ghi thử một tệp rỗng để biết chỗ này có thật sự dùng được không.
function Test-GhiDuoc {
    param([Parameter(Mandatory)][string]$Duong)
    try {
        if (-not (Test-Path $Duong)) {
            New-Item -ItemType Directory -Path $Duong -Force -ErrorAction Stop | Out-Null
        }
        $thu = Join-Path $Duong ".mercury-ghi-thu"
        [IO.File]::WriteAllText($thu, "")
        Remove-Item $thu -Force -ErrorAction SilentlyContinue
        return $true
    } catch {
        return $false
    }
}

function Tim-ThuMucSaoLuu {
    param(
        [Parameter(Mandatory)][string]$DuAn,
        # Đang TÌM ĐỂ ĐỌC (khôi phục): chỉ nhận chỗ đã có sẵn file backup-*.zip.
        [switch]$DeDoc
    )

    $chuDuAn = (Split-Path -Qualifier $DuAn).TrimEnd(":")
    $bando = Lay-BanDoDia
    $diaDuAn = if ($bando) { $bando[$chuDuAn] } else { $null }
    $coZip = {
        param($d)
        (Test-Path $d) -and (Get-ChildItem $d -Filter "backup-*.zip" -ErrorAction SilentlyContinue)
    }
    # Cùng đĩa vật lý? Không tra được bản đồ đĩa thì lùi về so chữ cái ổ.
    $cungDia = {
        param($chu)
        if ($bando -and $null -ne $diaDuAn -and $null -ne $bando[$chu]) {
            return ($bando[$chu] -eq $diaDuAn)
        }
        return ($chu -eq $chuDuAn)
    }

    # 1 + 2. Người vận hành chỉ định — tôn trọng tuyệt đối, kể cả khi cùng đĩa.
    foreach ($x in @(
        @{ duong = $env:BACKUP_DIR; nguon = "biến môi trường BACKUP_DIR" },
        @{ duong = (Doc-BackupDirTuEnv -DuAn $DuAn); nguon = "BACKUP_DIR trong .env" }
    )) {
        if ($x.duong) {
            $chu = (Split-Path -Qualifier $x.duong).TrimEnd(":")
            return [pscustomobject]@{
                Duong    = $x.duong
                Nguon    = $x.nguon
                CungODia = (& $cungDia $chu)
                CoSan    = [bool](& $coZip $x.duong)
            }
        }
    }

    $oDia = @()
    try {
        $oDia = Get-CimInstance Win32_LogicalDisk -ErrorAction Stop |
            Where-Object { $_.DriveType -in 2, 3 -and $_.FreeSpace -gt 0 }
    } catch {
        $oDia = Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue |
            Where-Object { $_.Free -gt 0 } |
            ForEach-Object {
                [pscustomobject]@{ DeviceID = "$($_.Name):"; DriveType = 3; FreeSpace = $_.Free }
            }
    }

    # 3. Ổ đã có sẵn thư mục sao lưu — ưu tiên cao nhất, để không bỏ quên bản cũ.
    foreach ($o in $oDia) {
        $thu = Join-Path "$($o.DeviceID)\" "backup-mercury"
        if (Test-Path $thu) {
            return [pscustomobject]@{
                Duong    = $thu
                Nguon    = "thư mục sao lưu đã có sẵn"
                CungODia = (& $cungDia $o.DeviceID.TrimEnd(":"))
                CoSan    = [bool](& $coZip $thu)
            }
        }
    }

    # Đang tìm để ĐỌC mà không thấy chỗ nào có sẵn thì báo không có, đừng bịa ra
    # một thư mục rỗng rồi bảo "không có bản sao lưu nào trong đó".
    if ($DeDoc) { return $null }

    # 4. Đĩa vật lý KHÁC và ghi được: ổ rời trước, rồi ổ trống nhiều nhất.
    $khacDia = $oDia | Where-Object { -not (& $cungDia $_.DeviceID.TrimEnd(":")) }
    $ungVien = @($khacDia | Where-Object { $_.DriveType -eq 2 } | Sort-Object FreeSpace -Descending) +
               @($khacDia | Where-Object { $_.DriveType -ne 2 } | Sort-Object FreeSpace -Descending)
    foreach ($o in $ungVien) {
        $thu = Join-Path "$($o.DeviceID)\" "backup-mercury"
        if (Test-GhiDuoc -Duong $thu) {
            return [pscustomobject]@{
                Duong    = $thu
                Nguon    = if ($o.DriveType -eq 2) { "ổ rời $($o.DeviceID) — khác đĩa vật lý" }
                           else { "ổ $($o.DeviceID) — khác đĩa vật lý" }
                CungODia = $false
                CoSan    = $false
            }
        }
    }

    # 5. Ổ khác chữ cái nhưng cùng đĩa, miễn là ghi được. An toàn hơn để cạnh
    #    dự án một chút (mất thư mục dự án vẫn còn), nhưng hỏng đĩa là mất cả.
    foreach ($o in ($oDia | Where-Object { $_.DeviceID.TrimEnd(":") -ne $chuDuAn } | Sort-Object FreeSpace -Descending)) {
        $thu = Join-Path "$($o.DeviceID)\" "backup-mercury"
        if (Test-GhiDuoc -Duong $thu) {
            return [pscustomobject]@{
                Duong    = $thu
                Nguon    = "ổ $($o.DeviceID) — CÙNG đĩa vật lý với dự án"
                CungODia = $true
                CoSan    = $false
            }
        }
    }

    # 6. Cuối cùng: cạnh thư mục dự án.
    return [pscustomobject]@{
        Duong    = Join-Path (Split-Path -Parent $DuAn) "backup-mercury"
        Nguon    = "cạnh thư mục dự án"
        CungODia = $true
        CoSan    = $false
    }
}

# In cảnh báo khi bản sao lưu nằm cùng đĩa vật lý với dữ liệu gốc.
function Canh-Bao-CungODia {
    param([Parameter(Mandatory)]$Cho)
    if (-not $Cho.CungODia) { return }
    Write-Host ""
    Write-Host "! Ban sao luu nam CUNG DIA VAT LY voi du lieu goc." -ForegroundColor Yellow
    Write-Host "  Hong dia la mat ca hai. Cam mot o ngoai roi chay lai, hoac dat" -ForegroundColor Yellow
    Write-Host "  BACKUP_DIR trong .env tro sang o khac / thu muc dong bo dam may." -ForegroundColor Yellow
}
