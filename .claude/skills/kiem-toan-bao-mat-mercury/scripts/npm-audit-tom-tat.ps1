# Tom tat npm audit cho goi chay that (--omit=dev), kem chi tiet tung advisory.
# Dung: powershell -NoProfile -File npm-audit-tom-tat.ps1 [-DuAn <thu muc>] [-CaDev]
param([string]$DuAn = (Get-Location).Path, [switch]$CaDev)
Set-Location $DuAn
$arg = @("audit", "--json"); if (-not $CaDev) { $arg += "--omit=dev" }
$raw = (& npm @arg 2>$null | Out-String)
try { $j = $raw | ConvertFrom-Json } catch { "npm audit khong tra JSON:"; $raw.Substring(0, [Math]::Min(800, $raw.Length)); exit 2 }
"=== so theo muc ($(if ($CaDev) { 'ca dev' } else { 'chi goi chay that' })) ==="
$j.metadata.vulnerabilities | ConvertTo-Json -Compress
"=== chi tiet ==="
foreach ($v in $j.vulnerabilities.PSObject.Properties) {
    $x = $v.Value
    $fix = if ($x.fixAvailable -is [bool]) { "$($x.fixAvailable)" } else { "$($x.fixAvailable.name)@$($x.fixAvailable.version)" + $(if ($x.fixAvailable.isSemVerMajor) { " (DOI MAJOR)" } else { "" }) }
    "  {0,-16} {1,-9} sua: {2}" -f $v.Name, $x.severity, $fix
    foreach ($via in $x.via) { if ($via -isnot [string]) { "      {0,-22} {1}`n      {2}" -f $via.range, $via.title, $via.url } }
}
$tong = $j.metadata.vulnerabilities
exit $(if (($tong.critical + $tong.high) -gt 0) { 1 } else { 0 })
