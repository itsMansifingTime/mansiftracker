# Kill Node processes tied to Next.js dev for THIS repo only.
# IMPORTANT: Do not use a broad '*mansiftracker*next*' match — that matches almost
# every script under node_modules. Keep patterns narrow.
$repo = [regex]::Escape((Resolve-Path (Join-Path $PSScriptRoot '..')).Path)
$targets = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
  Where-Object {
    $c = $_.CommandLine
    if (-not $c) { return $false }
    if ($c -notmatch $repo) { return $false }
    # Only `.next\dev` and the `next dev` CLI — do not match `...\next\dist\...\next-server.js`
    # (that can appear in unrelated tool command lines and kill IDE helpers).
    return (
      $c -like '*\.next\dev*' -or
      $c -match 'next(\.cmd)?["\s]+dev'
    )
  }

foreach ($p in $targets) {
  try {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
    Write-Host "Stopped PID $($p.ProcessId)"
  } catch {
    Write-Host "Skip PID $($p.ProcessId): $_"
  }
}

if (-not $targets) {
  Write-Host "No matching mansiftracker / Next dev processes found."
}
