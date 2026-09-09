# Phần dùng chung cho sao lưu và khôi phục: đọc DATABASE_URL, tìm công cụ
# PostgreSQL, chạy psql, tính dấu vân tay dữ liệu.
#
# Dot-source từ script khác:  . "$PSScriptRoot\lib-postgres.ps1"

function Doc-KetNoi {
    param([Parameter(Mandatory)][string]$DuAn, [string]$FileEnv)

    if (-not $FileEnv) { $FileEnv = Join-Path $DuAn ".env" }
    if (-not (Test-Path $FileEnv)) {
        throw "Không thấy file .env ở $FileEnv — không biết kết nối database nào."
    }

    $url = $null
    foreach ($line in Get-Content $FileEnv) {
        if ($line -match '^\s*DATABASE_URL\s*=\s*"?([^"]+)"?\s*$') { $url = $Matches[1]; break }
    }
    if (-not $url) { throw "Không thấy DATABASE_URL trong $FileEnv." }

    # postgresql://user:pass@host:port/tendb?schema=public
    if ($url -notmatch '^postgres(ql)?://([^:]+):([^@]*)@([^:/]+):(\d+)/([^?]+)') {
        throw "DATABASE_URL không phải chuỗi kết nối PostgreSQL hợp lệ."
    }

    [pscustomobject]@{
        NguoiDung = $Matches[2]
        MatKhau   = [System.Uri]::UnescapeDataString($Matches[3])
        May       = $Matches[4]
        Cong      = $Matches[5]
        TenDb     = $Matches[6]
    }
}

# Tìm pg_dump / pg_restore / psql: ưu tiên PATH, rồi bản PostgreSQL RIÊNG của
# dự án, cuối cùng mới tới bản cài dạng dịch vụ.
#
# Bản riêng (..\pgsql cạnh thư mục dự án) phải được dò: đó chính là bản mà máy
# này đang chạy — cài dạng xách tay, không nằm trong PATH và không nằm ở
# "C:\Program Files\PostgreSQL". Thiếu nhánh đó thì sao lưu và khôi phục đều
# chết ngay ở bước tìm công cụ, dù database vẫn chạy bình thường ngay bên cạnh.
function Tim-CongCuPg {
    param([Parameter(Mandatory)][string]$Ten)

    $duong = (Get-Command $Ten -ErrorAction SilentlyContinue).Source
    if ($duong) { return $duong }

    # Bản xách tay của dự án: <cha của mercury-materials>\pgsql\bin
    $gocDuAn = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    $rieng = Join-Path $gocDuAn "pgsql\bin\$Ten.exe"
    if (Test-Path $rieng) { return $rieng }

    $duong = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
             Sort-Object Name -Descending |
             ForEach-Object { Join-Path $_.FullName "bin\$Ten.exe" } |
             Where-Object { Test-Path $_ } |
             Select-Object -First 1
    if ($duong) { return $duong }

    throw ("Không tìm thấy $Ten.exe. Đã dò: PATH, $rieng, và C:\Program Files\PostgreSQL.`n" +
           "Cài PostgreSQL client hoặc thêm thư mục bin vào PATH.")
}

<#
Chạy một chương trình ngoài (pg_dump, pg_restore) và trả về mã thoát.

Phải dùng Start-Process chứ không gọi thẳng `& $exe`: PowerShell 5.1 bọc mỗi
dòng stderr của chương trình ngoài thành ErrorRecord, mà script chạy với
$ErrorActionPreference = "Stop" nên chỉ một dòng cảnh báo bình thường của
pg_restore cũng làm cả script văng ra giữa chừng.
#>
function Chay-Lenh {
    param(
        [Parameter(Mandatory)][string]$Exe,
        [Parameter(Mandatory)][string[]]$ThamSo,
        [Parameter(Mandatory)][string]$FileLog,
        [string]$MatKhau
    )

    $logErr = "$FileLog.err"
    if ($MatKhau) { $env:PGPASSWORD = $MatKhau }
    try {
        $p = Start-Process -FilePath $Exe -ArgumentList $ThamSo -NoNewWindow -Wait -PassThru `
                           -RedirectStandardOutput $FileLog -RedirectStandardError $logErr
        # Gộp stderr vào cuối log cho dễ đọc khi có lỗi.
        if (Test-Path $logErr) {
            Get-Content $logErr -ErrorAction SilentlyContinue | Add-Content $FileLog
            Remove-Item $logErr -Force -ErrorAction SilentlyContinue
        }
        return $p.ExitCode
    } finally {
        if ($MatKhau) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
    }
}

# Chạy một câu SQL, trả về các dòng kết quả (không tiêu đề, ngăn bằng |).
function Chay-Sql {
    param(
        [Parameter(Mandatory)]$KetNoi,
        [Parameter(Mandatory)][string]$Sql,
        [string]$TenDb
    )
    if (-not $TenDb) { $TenDb = $KetNoi.TenDb }
    $psql = Tim-CongCuPg "psql"

    # Truyền SQL qua file: PowerShell 5.1 hay nuốt dấu nháy khi đưa thẳng vào -c.
    $tam = Join-Path $env:TEMP ("mercury-sql-" + [guid]::NewGuid().ToString("N") + ".sql")
    Set-Content -Path $tam -Value $Sql -Encoding utf8
    $env:PGPASSWORD = $KetNoi.MatKhau
    $env:PGCLIENTENCODING = "UTF8"
    try {
        $kq = & $psql -h $KetNoi.May -p $KetNoi.Cong -U $KetNoi.NguoiDung -d $TenDb `
                      -v ON_ERROR_STOP=1 -At -F "|" -f $tam
        if ($LASTEXITCODE -ne 0) { throw "psql trả về mã lỗi $LASTEXITCODE" }
        return $kq
    } finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
        Remove-Item Env:PGCLIENTENCODING -ErrorAction SilentlyContinue
        Remove-Item $tam -Force -ErrorAction SilentlyContinue
    }
}

<#
Dấu vân tay dữ liệu: mỗi bảng một dòng "tên|số dòng|md5".

md5 tính trên toàn bộ nội dung các dòng đã sắp theo id, nên đổi một ô dữ liệu
là vân tay đổi theo. So vân tay trước và sau khi khôi phục mới biết được bản
khôi phục có đúng bằng bản đã sao lưu hay không — chỉ so số dòng thì một bản
ghi bị sửa nội dung vẫn lọt.

Bảng không có cột id (ví dụ _prisma_migrations) thì chỉ đếm số dòng.
#>
function Lay-VanTay {
    param([Parameter(Mandatory)]$KetNoi, [string]$TenDb)

    $sqlBang = @"
SELECT c.relname,
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = c.relname AND column_name = 'id')
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;
"@
    $bang = Chay-Sql -KetNoi $KetNoi -TenDb $TenDb -Sql $sqlBang

    $phan = @()
    foreach ($dong in $bang) {
        if (-not $dong) { continue }
        $ten, $coId = $dong -split '\|'
        $tenEsc = $ten -replace '"', '""'
        if ($coId -eq "t") {
            $phan += "SELECT '$ten'::text, count(*)::bigint, md5(coalesce(string_agg(t::text, '|' ORDER BY t.id), '')) FROM ""$tenEsc"" t"
        } else {
            $phan += "SELECT '$ten'::text, count(*)::bigint, ''::text FROM ""$tenEsc"" t"
        }
    }
    if (-not $phan) { return @{} }

    $dongKq = Chay-Sql -KetNoi $KetNoi -TenDb $TenDb -Sql (($phan -join "`nUNION ALL`n") + "`nORDER BY 1;")

    $vanTay = [ordered]@{}
    foreach ($d in $dongKq) {
        if (-not $d) { continue }
        $t, $so, $md5 = $d -split '\|'
        $vanTay[$t] = [pscustomobject]@{ so = [int64]$so; md5 = $md5 }
    }
    return $vanTay
}

# So hai dấu vân tay, in bảng khác biệt. Trả về $true nếu khớp hoàn toàn.
function So-VanTay {
    param($Truoc, $Sau)

    $tenBang = @($Truoc.Keys) + @($Sau.Keys) | Sort-Object -Unique
    $lech = @()
    foreach ($t in $tenBang) {
        $a = $Truoc[$t]; $b = $Sau[$t]
        if (-not $a) { $lech += "  + $t  (chỉ có sau khi khôi phục, $($b.so) dòng)"; continue }
        if (-not $b) { $lech += "  - $t  (mất sau khi khôi phục, đáng lẽ $($a.so) dòng)"; continue }
        if ($a.so -ne $b.so) { $lech += "  ! $t  số dòng $($a.so) -> $($b.so)"; continue }
        if ($a.md5 -ne $b.md5) { $lech += "  ! $t  đủ $($a.so) dòng nhưng NỘI DUNG khác" }
    }

    if ($lech.Count -eq 0) { return $true }
    Write-Host ""
    Write-Host "KHÁC BIỆT:" -ForegroundColor Red
    $lech | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    return $false
}
