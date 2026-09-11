# Trich moi khoa tinh t("ns.khoa") / tTuDo("ns.khoa") trong app/ va components/, so voi khoi VI cua lib/i18n/dict/ns.ts.
# Dung: powershell -NoProfile -File doi-chieu-khoa-tu-dien.ps1 [-DuAn <thu muc du an>]
param([string]$DuAn = (Get-Location).Path)
$dict = Join-Path $DuAn "lib\i18n\dict"
$khoaCua = @{}
foreach ($f in Get-ChildItem $dict -Filter "*.ts" | Where-Object { $_.Name -ne "_kieu.ts" }) {
    $ns = [IO.Path]::GetFileNameWithoutExtension($f.Name)
    $set = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($m in [regex]::Matches([IO.File]::ReadAllText($f.FullName), '(?m)^\s+([A-Za-z0-9_]+):\s*(?:"|\x27|`|\r?\n\s+")')) { [void]$set.Add($m.Groups[1].Value) }
    $khoaCua[$ns] = $set
}
$dung = @{}
$tep = Get-ChildItem (Join-Path $DuAn "app"), (Join-Path $DuAn "components") -Recurse -Include *.tsx,*.ts | Where-Object { $_.FullName -notmatch '\\node_modules\\|\\\.next\\' }
foreach ($f in $tep) {
    $c = [IO.File]::ReadAllText($f.FullName)
    foreach ($m in [regex]::Matches($c, '\bt(?:TuDo)?\(\s*"([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)"')) {
        $k = $m.Groups[1].Value + "." + $m.Groups[2].Value
        if (-not $dung.ContainsKey($k)) { $dung[$k] = @() }
        $dung[$k] += $f.FullName.Substring($DuAn.Length + 1)
    }
}
$thieu = 0; $nsLa = 0
foreach ($k in ($dung.Keys | Sort-Object)) {
    $ns, $khoa = $k.Split('.', 2)
    if (-not $khoaCua.ContainsKey($ns)) { $nsLa++; "  KHONG CO NAMESPACE  $k   <- $($dung[$k] | Select-Object -First 1)"; continue }
    if (-not $khoaCua[$ns].Contains($khoa)) { $thieu++; "  THIEU KHOA          $k   <- $($dung[$k] | Select-Object -First 1)" }
}
"=== khoa tinh dang dung: $($dung.Count); thieu: $thieu; namespace la: $nsLa (khoa dong tTuDo voi chuoi ghep khong kiem duoc o day) ==="
exit $(if (($thieu + $nsLa) -eq 0) { 0 } else { 1 })
