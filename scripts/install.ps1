# AMoon Launcher — Windows installer
# irm https://cdn-rcf.anhcong.dev/install.ps1 | iex

$ErrorActionPreference = "Stop"
$CDN_BASE    = "https://cdn-rcf.anhcong.dev/releases"
$INSTALL_DIR = "$env:LOCALAPPDATA\AMoonLauncher"
$VERSION     = "latest"
$APP_NAME    = "amoon-launcher"

# ── Unicode + color helpers ───────────────────────────────────────────────────
$W = $Host.UI.RawUI.WindowSize.Width
if (-not $W -or $W -lt 56) { $W = 56 }
$IW = 54  # inner width

function Box-Top   { Write-Host ("╭" + "─" * $IW + "╮") -ForegroundColor DarkGray }
function Box-Bot   { Write-Host ("╰" + "─" * $IW + "╯") -ForegroundColor DarkGray }
function Box-Sep   { Write-Host ("├" + "─" * $IW + "┤") -ForegroundColor DarkGray }
function Box-Line  {
  param([string]$text = "", [ConsoleColor]$color = "Gray")
  $pad = $IW - 2 - $text.Length
  if ($pad -lt 0) { $pad = 0 }
  Write-Host "│ " -ForegroundColor DarkGray -NoNewline
  Write-Host ($text + (" " * $pad)) -ForegroundColor $color -NoNewline
  Write-Host " │" -ForegroundColor DarkGray
}
function Box-Ok    { param($t) Box-Line "✔  $t" Green  }
function Box-Fail  { param($t) Box-Line "✘  $t" Red    }
function Box-Warn  { param($t) Box-Line "⚠  $t" Yellow }
function Box-Info  { param($t) Box-Line "→  $t" Cyan   }
function Box-Blank { Box-Line "" }

function Spin {
  param([string]$msg, [scriptblock]$action)
  $frames = @('⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏')
  $job = Start-Job -ScriptBlock $action
  $i = 0
  while ($job.State -eq 'Running') {
    $f = $frames[$i % $frames.Count]
    Write-Host ("`r│ $f  $msg" + (" " * 10)) -NoNewline -ForegroundColor Cyan
    Start-Sleep -Milliseconds 80
    $i++
  }
  Write-Host ("`r" + (" " * ($IW + 4))) -NoNewline  # clear line
  Write-Host "`r" -NoNewline
  Receive-Job $job -Wait -ErrorAction Stop | Out-Null
  Remove-Job $job
}

# ── Banner ────────────────────────────────────────────────────────────────────
Clear-Host
Write-Host ""
Box-Top
Box-Blank
Write-Host "│  " -ForegroundColor DarkGray -NoNewline
Write-Host "    _   __  ___                    " -ForegroundColor Blue -NoNewline
Write-Host "           │" -ForegroundColor DarkGray
Write-Host "│  " -ForegroundColor DarkGray -NoNewline
Write-Host "   /_\ |  \/  |___  ___  _ _      " -ForegroundColor Blue -NoNewline
Write-Host "           │" -ForegroundColor DarkGray
Write-Host "│  " -ForegroundColor DarkGray -NoNewline
Write-Host "  / _ \| |\/| / _ \/ _ \| ' \     " -ForegroundColor Blue -NoNewline
Write-Host "           │" -ForegroundColor DarkGray
Write-Host "│  " -ForegroundColor DarkGray -NoNewline
Write-Host " /_/ \_\_|  |_\___/\___/|_||_|    " -ForegroundColor Blue -NoNewline
Write-Host "           │" -ForegroundColor DarkGray
Box-Blank
Write-Host "│  " -ForegroundColor DarkGray -NoNewline
Write-Host "  Launcher for Minecraft" -ForegroundColor White -NoNewline
Write-Host " · anhcong.dev" -ForegroundColor DarkGray -NoNewline
Write-Host "        │" -ForegroundColor DarkGray
Box-Blank
Box-Sep

# ── Detect ────────────────────────────────────────────────────────────────────
$arch = $env:PROCESSOR_ARCHITECTURE
$ARCH_TAG = switch ($arch) {
  "AMD64" { "x86_64" }
  "ARM64" { "aarch64" }
  default { Box-Fail "Unsupported arch: $arch"; Box-Bot; exit 1 }
}
Box-Ok "Platform: windows/$ARCH_TAG"

# ── System check ──────────────────────────────────────────────────────────────
Box-Sep
$ramGB  = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
$ramMB  = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1MB)
if ($ramMB -lt 2048) { Box-Warn "RAM: ${ramGB}GB  (min 2GB recommended)" }
else                  { Box-Ok   "RAM: ${ramGB}GB" }

$drive  = Split-Path $INSTALL_DIR -Qualifier
$disk   = Get-PSDrive -Name $drive.TrimEnd(':') -ErrorAction SilentlyContinue
$freeGB = if ($disk) { [math]::Round($disk.Free / 1GB, 1) } else { 99 }
$freeMB = if ($disk) { [math]::Round($disk.Free / 1MB) }    else { 99999 }
if ($freeMB -lt 500) { Box-Fail "Disk: ${freeGB}GB free — need 500MB"; Box-Bot; exit 1 }
else                  { Box-Ok  "Disk: ${freeGB}GB free" }

$java = Get-Command java -ErrorAction SilentlyContinue
if ($java) {
  $jv = (java -version 2>&1)[0] -replace '.*"(.*)".*','$1'
  Box-Ok "Java: $jv"
} else {
  Box-Warn "Java: not found (set up on first launch)"
}

# ── Resolve version ───────────────────────────────────────────────────────────
Box-Sep
$ProgressPreference = "SilentlyContinue"
if ($VERSION -eq "latest") {
  try { $VERSION = (Invoke-RestMethod "$CDN_BASE/latest.txt").Trim() }
  catch { $VERSION = "0.1.0" }
}
Box-Ok "Version: $VERSION"

# ── Download ──────────────────────────────────────────────────────────────────
$FILENAME     = "$APP_NAME-$VERSION-windows-$ARCH_TAG.zip"
$DOWNLOAD_URL = "$CDN_BASE/$VERSION/$FILENAME"
$TMP_DIR      = Join-Path $env:TEMP "amoon-install-$VERSION"
$TMP_FILE     = Join-Path $TMP_DIR $FILENAME
New-Item -ItemType Directory -Path $TMP_DIR -Force | Out-Null

Box-Sep
$dlSize = ""
try {
  Spin "Downloading $FILENAME..." {
    Invoke-WebRequest -Uri $using:DOWNLOAD_URL -OutFile $using:TMP_FILE -UseBasicParsing
  }
  $dlSize = "$([math]::Round((Get-Item $TMP_FILE).Length / 1MB, 1)) MB"
} catch {
  Box-Fail "Download failed: $_"; Box-Bot; exit 1
}
Box-Ok "Downloaded: $dlSize"

# ── Verify checksum ───────────────────────────────────────────────────────────
try {
  $expected = (Invoke-RestMethod "$DOWNLOAD_URL.sha256").Trim()
  $actual   = (Get-FileHash $TMP_FILE -Algorithm SHA256).Hash.ToLower()
  if ($actual -eq $expected.ToLower()) { Box-Ok "Checksum verified" }
  else { Box-Fail "Checksum mismatch!"; Remove-Item $TMP_DIR -Recurse -Force; Box-Bot; exit 1 }
} catch { Box-Warn "Checksum skipped" }

# ── Install ───────────────────────────────────────────────────────────────────
if (Test-Path $INSTALL_DIR) { Remove-Item "$INSTALL_DIR\*" -Recurse -Force }
else { New-Item -ItemType Directory -Path $INSTALL_DIR | Out-Null }
Expand-Archive -Path $TMP_FILE -DestinationPath $INSTALL_DIR -Force
Remove-Item $TMP_DIR -Recurse -Force
Box-Ok "Installed to $INSTALL_DIR"

# ── Shortcuts ─────────────────────────────────────────────────────────────────
$wsh = New-Object -ComObject WScript.Shell

$startMenu = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\AMoon Launcher.lnk"
$sc = $wsh.CreateShortcut($startMenu)
$sc.TargetPath = "$INSTALL_DIR\$APP_NAME.exe"
$sc.Save()
Box-Ok "Start Menu shortcut"

$desktop = "$env:USERPROFILE\Desktop\AMoon Launcher.lnk"
$sc2 = $wsh.CreateShortcut($desktop)
$sc2.TargetPath = "$INSTALL_DIR\$APP_NAME.exe"
$sc2.Save()
Box-Ok "Desktop shortcut"

# ── PATH ──────────────────────────────────────────────────────────────────────
$cur = [Environment]::GetEnvironmentVariable("Path","User")
if ($cur -notlike "*$INSTALL_DIR*") {
  [Environment]::SetEnvironmentVariable("Path","$cur;$INSTALL_DIR","User")
  Box-Ok "Added to PATH"
}

# ── Done ─────────────────────────────────────────────────────────────────────
Box-Sep
Box-Blank
Write-Host "│  " -ForegroundColor DarkGray -NoNewline
Write-Host "✔  AMoon Launcher $VERSION installed!" -ForegroundColor Green -NoNewline
Write-Host (" " * [Math]::Max(0, $IW - 34)) -NoNewline
Write-Host "│" -ForegroundColor DarkGray
Box-Blank
Box-Info "Launch from Desktop or Start Menu"
Box-Info "Or run: amoon-launcher"
Box-Blank
Box-Bot
Write-Host ""

$ans = Read-Host "  Launch now? [Y/n]"
if ($ans -ne 'n' -and $ans -ne 'N') {
  Start-Process "$INSTALL_DIR\$APP_NAME.exe"
}
