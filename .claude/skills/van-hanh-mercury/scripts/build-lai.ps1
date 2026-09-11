# Dung app bang co dung chu y -> cho viec Task Scheduler ve Ready -> chay lai -> cho "Ready in" -> tham do.
# Dung: powershell -NoProfile -File build-lai.ps1 [-DuAn <thu muc du an>]
param([string]$DuAn = (Get-Location).Path)
$goc = Split-Path -Parent $DuAn
$log = Join-Path $goc "app-logs\app.log"
$ten = "MercuryMaterials"
function DocLogMoi($mark) { $fs = [IO.File]::Open($log, 'Open', 'Read', 'ReadWrite'); $fs.Position = [Math]::Min($mark, $fs.Length); $sr = New-Object IO.StreamReader($fs, 'UTF8'); $t = $sr.ReadToEnd(); $sr.Close(); return $t }
function Cong3000 { [bool](Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) }
"=== 1. dung app (co dung chu y) ==="
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $DuAn "scripts\dung-app.ps1") 2>&1 | Where-Object { $_ -match "node|3000" } | ForEach-Object { "  $_" }
$ready = $false
for ($i = 0; $i -lt 60; $i++) { Start-Sleep -Seconds 1; if ((Get-ScheduledTask -TaskName $ten -ErrorAction SilentlyContinue).State -eq "Ready") { $ready = $true; break } }
"  viec ve Ready: $ready | cong 3000 trong: $(-not (Cong3000))"
if (-not $ready) { "  Viec khong ve Ready sau 60s - dung lai, xem Task Scheduler."; exit 2 }
"=== 2. chay lai qua Task Scheduler ==="
$mark = (Get-Item $log).Length
schtasks /Run /TN $ten | Out-Null
$sw = [Diagnostics.Stopwatch]::StartNew(); $ket = ""; $new = ""
while ($sw.Elapsed.TotalSeconds -lt 360) {
    Start-Sleep -Seconds 3; $new = DocLogMoi $mark
    if ($new -match "Build th|KHÔNG CHẠY|KHONG CHAY") { $ket = "FAIL"; break }
    if ($new -match "Ready in") { $ket = "READY"; break }
}
"  ket qua: $ket sau $([int]$sw.Elapsed.TotalSeconds)s"
($new -split "`r?`n" | Where-Object { $_ -match "build|Build|Ready in|rror|CHAY" }) | ForEach-Object { "  log: $_" }
if ($ket -ne "READY") { "--- 30 dong cuoi log ---"; ($new -split "`r?`n" | Select-Object -Last 30) | ForEach-Object { "  $_" }; exit 1 }
Start-Sleep -Seconds 2
"=== 3. tham do ==="
"  /login -> " + (curl.exe -sS -o NUL -w "%{http_code}" "http://localhost:3000/login" 2>$null) + " (mong 200) | /dashboard -> " + (curl.exe -sS -o NUL -w "%{http_code}" "http://localhost:3000/dashboard" 2>$null) + " (mong 307)"
$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($p) { $pr = Get-Process -Id $p.OwningProcess; "  node PID {0}, RAM {1:N0} MB" -f $p.OwningProcess, ($pr.WorkingSet64 / 1MB) }
