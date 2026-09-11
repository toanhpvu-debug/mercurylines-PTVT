# Moi tep .tsx co bang: dem <Th trong tung <thead>...</thead> va liet ke colSpan={n}; n khong bang so cot nao -> nghi lech.
# Dung: powershell -NoProfile -File kiem-colspan.ps1 [-DuAn <thu muc du an>]
param([string]$DuAn = (Get-Location).Path)
$tep = Get-ChildItem (Join-Path $DuAn "app"), (Join-Path $DuAn "components") -Recurse -Include *.tsx
$nghi = 0
foreach ($f in $tep) {
    $c = [IO.File]::ReadAllText($f.FullName)
    $heads = [regex]::Matches($c, '(?s)<thead[^>]*>(.*?)</thead>') | ForEach-Object { ([regex]::Matches($_.Groups[1].Value, '<[Tt]h\b')).Count }
    $spans = [regex]::Matches($c, 'colSpan=\{(\d+)\}') | ForEach-Object { [int]$_.Groups[1].Value } | Sort-Object -Unique
    if (-not $heads -or -not $spans) { continue }
    $la = $spans | Where-Object { $heads -notcontains $_ }
    $ten = $f.FullName.Substring($DuAn.Length + 1)
    if ($la) { $nghi++; "  NGHI LECH  {0,-52} cot thead: {1}  colSpan: {2}" -f $ten, ($heads -join "/"), ($spans -join ",") }
    else     { "  ok         {0,-52} cot thead: {1}  colSpan: {2}" -f $ten, ($heads -join "/"), ($spans -join ",") }
}
"=== nghi lech: $nghi (bang co nhieu phan thead hoac colSpan co y nho hon so cot thi kiem tay) ==="
