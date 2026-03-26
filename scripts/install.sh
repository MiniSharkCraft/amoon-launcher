#!/usr/bin/env bash
# AMoon Launcher — Linux/macOS installer
# curl -fsSL https://cdn-rcf.anhcong.dev/install.sh | bash

set -euo pipefail

CDN_BASE="https://cdn-rcf.anhcong.dev/releases"
INSTALL_DIR="${HOME}/.local/share/amoon-launcher"
BIN_DIR="${HOME}/.local/bin"
VERSION="latest"
APP_NAME="amoon-launcher"

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --dir)     INSTALL_DIR="$2"; shift 2 ;;
    --version) VERSION="$2";     shift 2 ;;
    *) shift ;;
  esac
done

# ── Colors & symbols ──────────────────────────────────────────────────────────
if [ -t 1 ] && [ "${TERM:-}" != "dumb" ]; then
  R='\033[0;31m'  G='\033[0;32m'  Y='\033[0;33m'
  B='\033[0;34m'  M='\033[0;35m'  C='\033[0;36m'
  W='\033[1;37m'  DIM='\033[2m'   RESET='\033[0m'
  BOLD='\033[1m'
else
  R='' G='' Y='' B='' M='' C='' W='' DIM='' RESET='' BOLD=''
fi

WIDTH=54

line()  { printf "${DIM}│${RESET}%-${WIDTH}s${DIM}│${RESET}\n" "$1"; }
linef() { printf "${DIM}│${RESET} %-$((WIDTH-1))s${DIM}│${RESET}\n" "$1"; }
sep()   { printf "${DIM}├$(printf '─%.0s' $(seq 1 $WIDTH))┤${RESET}\n"; }
top()   { printf "${DIM}╭$(printf '─%.0s' $(seq 1 $WIDTH))╮${RESET}\n"; }
bot()   { printf "${DIM}╰$(printf '─%.0s' $(seq 1 $WIDTH))╯${RESET}\n"; }

ok()    { linef "${G}✔${RESET} $1"; }
fail()  { linef "${R}✘${RESET} $1"; }
warn()  { linef "${Y}⚠${RESET} $1"; }
info()  { linef "${C}→${RESET} $1"; }
blank() { linef ""; }

# ── Spinner ───────────────────────────────────────────────────────────────────
_spin_pid=""
spin_start() {
  local msg="$1"
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  (
    i=0
    while true; do
      printf "\r${DIM}│${RESET} ${C}${frames[$((i % 10))]}${RESET} %-$((WIDTH-3))s${DIM}│${RESET}" "$msg"
      sleep 0.08
      i=$((i+1))
    done
  ) &
  _spin_pid=$!
}
spin_stop() {
  if [ -n "$_spin_pid" ]; then
    kill "$_spin_pid" 2>/dev/null; wait "$_spin_pid" 2>/dev/null || true
    _spin_pid=""
    printf "\r"
  fi
}
trap 'spin_stop' EXIT

# ── Banner ────────────────────────────────────────────────────────────────────
clear 2>/dev/null || true
echo ""
top
linef ""
printf "${DIM}│${RESET}  ${B}${BOLD}    _   __  ___                    ${RESET}            ${DIM}│${RESET}\n"
printf "${DIM}│${RESET}  ${B}${BOLD}   /_\ |  \/  |___  ___  _ _       ${RESET}            ${DIM}│${RESET}\n"
printf "${DIM}│${RESET}  ${B}${BOLD}  / _ \| |\/| / _ \/ _ \| ' \      ${RESET}            ${DIM}│${RESET}\n"
printf "${DIM}│${RESET}  ${B}${BOLD} /_/ \_\_|  |_\___/\___/|_||_|     ${RESET}            ${DIM}│${RESET}\n"
linef ""
printf "${DIM}│${RESET}     ${W}Launcher for Minecraft${RESET} ${DIM}· anhcong.dev${RESET}        ${DIM}│${RESET}\n"
linef ""
sep

# ── Detect OS & arch ─────────────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux)  PLATFORM="linux" ;;
  Darwin) PLATFORM="macos" ;;
  *)
    fail "Unsupported OS: $OS"
    bot; exit 1 ;;
esac
case "$ARCH" in
  x86_64)        ARCH_TAG="x86_64" ;;
  aarch64|arm64) ARCH_TAG="aarch64" ;;
  *)
    fail "Unsupported arch: $ARCH"
    bot; exit 1 ;;
esac

ok "Platform: ${PLATFORM}/${ARCH_TAG}"

# ── System check ──────────────────────────────────────────────────────────────
sep

if [ -f /proc/meminfo ]; then
  RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
  RAM_MB=$((RAM_KB / 1024))
  RAM_GB=$(awk "BEGIN {printf \"%.1f\", $RAM_MB/1024}")
  if [ "$RAM_MB" -lt 2048 ]; then
    warn "RAM: ${RAM_GB}GB  (min 2GB recommended)"
  else
    ok   "RAM: ${RAM_GB}GB"
  fi
fi

FREE_KB=$(df -k "${HOME}" 2>/dev/null | awk 'NR==2 {print $4}' || echo 999999)
FREE_GB=$(awk "BEGIN {printf \"%.1f\", $FREE_KB/1024/1024}")
if [ "$((FREE_KB / 1024))" -lt 500 ]; then
  fail "Disk: ${FREE_GB}GB free — need at least 500MB"
  bot; exit 1
fi
ok "Disk: ${FREE_GB}GB free"

if command -v java &>/dev/null; then
  JAVA_VER=$(java -version 2>&1 | head -1 | sed 's/.*"\([^"]*\)".*/\1/')
  ok "Java: ${JAVA_VER}"
else
  warn "Java: not found (will be set up on first launch)"
fi

# ── Resolve version ───────────────────────────────────────────────────────────
sep
if [ "$VERSION" = "latest" ]; then
  spin_start "Fetching latest version..."
  VERSION=$(curl -fsSL "${CDN_BASE}/latest.txt" 2>/dev/null || echo "0.1.0")
  spin_stop
fi
ok "Version: ${VERSION}"

# ── Download ──────────────────────────────────────────────────────────────────
FILENAME="${APP_NAME}-${VERSION}-${PLATFORM}-${ARCH_TAG}.tar.gz"
DOWNLOAD_URL="${CDN_BASE}/${VERSION}/${FILENAME}"
TMP_DIR="$(mktemp -d)"
TMP_FILE="${TMP_DIR}/${FILENAME}"

sep
spin_start "Downloading ${FILENAME}..."
if command -v curl &>/dev/null; then
  curl -fsSL "$DOWNLOAD_URL" -o "$TMP_FILE" 2>/dev/null
else
  wget -qO "$TMP_FILE" "$DOWNLOAD_URL" 2>/dev/null
fi
spin_stop

SIZE=$(du -h "$TMP_FILE" | cut -f1)
ok "Downloaded: ${SIZE}"

# ── Verify checksum ───────────────────────────────────────────────────────────
EXPECTED_SHA=$(curl -fsSL "${DOWNLOAD_URL}.sha256" 2>/dev/null || true)
if [ -n "$EXPECTED_SHA" ] && command -v sha256sum &>/dev/null; then
  spin_start "Verifying checksum..."
  ACTUAL_SHA=$(sha256sum "$TMP_FILE" | awk '{print $1}')
  spin_stop
  if [ "$ACTUAL_SHA" = "$EXPECTED_SHA" ]; then
    ok "Checksum verified"
  else
    fail "Checksum mismatch!"
    rm -rf "$TMP_DIR"; bot; exit 1
  fi
fi

# ── Install ───────────────────────────────────────────────────────────────────
spin_start "Installing to ${INSTALL_DIR}..."
mkdir -p "$INSTALL_DIR"
tar -xzf "$TMP_FILE" -C "$INSTALL_DIR" --strip-components=1 2>/dev/null || \
  tar -xzf "$TMP_FILE" -C "$INSTALL_DIR"
chmod +x "${INSTALL_DIR}/${APP_NAME}" 2>/dev/null || true
rm -rf "$TMP_DIR"
spin_stop
ok "Installed"

# ── Desktop entry (Linux) ─────────────────────────────────────────────────────
if [ "$PLATFORM" = "linux" ]; then
  DESKTOP_DIR="${HOME}/.local/share/applications"
  mkdir -p "$DESKTOP_DIR"
  cat > "${DESKTOP_DIR}/amoon-launcher.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=AMoon Launcher
Comment=Minecraft Launcher by AMoon Team
Exec=${INSTALL_DIR}/amoon-launcher
Icon=${INSTALL_DIR}/icon.png
Categories=Game;
Terminal=false
StartupWMClass=amoon-launcher
EOF
  ok "App menu shortcut created"
fi

# ── PATH ──────────────────────────────────────────────────────────────────────
mkdir -p "$BIN_DIR"
ln -sf "${INSTALL_DIR}/${APP_NAME}" "${BIN_DIR}/${APP_NAME}"
ok "Symlink: ${BIN_DIR}/${APP_NAME}"

# ── Done ─────────────────────────────────────────────────────────────────────
sep
blank
printf "${DIM}│${RESET}  ${G}${BOLD}✔  AMoon Launcher ${VERSION} installed!${RESET}             ${DIM}│${RESET}\n"
blank
info "Run: ${BOLD}${APP_NAME}${RESET}"
info "Or open from your app menu"
blank

if ! echo "$PATH" | grep -q "$BIN_DIR"; then
  sep
  warn "Add to PATH — paste into ~/.bashrc or ~/.zshrc:"
  linef "  ${DIM}export PATH=\"\${HOME}/.local/bin:\${PATH}\"${RESET}"
fi

bot
echo ""
