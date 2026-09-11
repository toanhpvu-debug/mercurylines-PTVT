# Tim chuoi co dau tieng Viet viet cung trong .tsx/.ts (ngoai tu dien va chung tu in).
# Dung: powershell -NoProfile -File tim-chu-cung.ps1 [-DuAn <thu muc>]
# Duong dan duoc doi sang dau "/" truoc khi so, de regex khong dinh dau "\" cua Windows.
param([string]$DuAn = (Get-Location).Path)
$boQua = 'i18n/dict|FormDocHeader|requests/\[id\]|purchasing/\[id\]|reports/page|node_modules|/\.next/|/scripts/'
$mau = '[ăâđêôơưĂÂĐÊÔƠƯàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]'
$tep = Get-ChildItem (Join-Path $DuAn "app"), (Join-Path $DuAn "components"), (Join-Path $DuAn "lib") -Recurse -Include *.tsx,*.ts |
    Where-Object { ($_.FullName.Replace('\', '/')) -notmatch $boQua }
$n = 0
foreach ($f in $tep) {
    $i = 0
    foreach ($dong in [IO.File]::ReadAllLines($f.FullName)) {
        $i++
        $t = $dong.Trim()
        if ($t -match '^(//|\*|/\*|\{/\*)') { continue }   # comment
        if ($t -match $mau) {
            $n++
            "  {0}:{1}: {2}" -f $f.FullName.Substring($DuAn.Length + 1), $i, $t.Substring(0, [Math]::Min(110, $t.Length))
        }
    }
}
"=== $n dong co chu Viet ngoai tu dien (kiem tay: chuoi trong JSX/props/thong bao la chu cung; ten bien/comment cuoi dong thi khong) ==="
