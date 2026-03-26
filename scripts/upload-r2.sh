#!/usr/bin/env bash
# Upload launcher artifacts to Cloudflare R2 (thủ công)
# Usage: ./scripts/upload-r2.sh [version]
#
# Cần set các env vars (hoặc copy vào .env.r2):
#   R2_ACCESS_KEY_ID=...
#   R2_SECRET_ACCESS_KEY=...
#   R2_ACCOUNT_ID=...       (Account ID trong R2 dashboard)
#   R2_BUCKET=amoon-cdn      (tên bucket)
#
# Cài awscli: pip install awscli
# Hoặc dùng wrangler: npm i -g wrangler

set -euo pipefail

# ── Load .env.r2 nếu có ──────────────────────────────────────────────────────
if [ -f ".env.r2" ]; then
  set -a; source .env.r2; set +a
fi

# ── Validate ─────────────────────────────────────────────────────────────────
: "${R2_ACCESS_KEY_ID:?Set R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?Set R2_SECRET_ACCESS_KEY}"
: "${R2_ACCOUNT_ID:?Set R2_ACCOUNT_ID}"
: "${R2_BUCKET:=amoon-cdn}"

ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"

# ── Detect version ────────────────────────────────────────────────────────────
VERSION="${1:-$(grep '"version"' src-tauri/tauri.conf.json | head -1 | sed 's/.*"\([0-9.]*\)".*/\1/')}"
echo "Version: $VERSION"

# ── Build nếu chưa có artifacts ──────────────────────────────────────────────
BUNDLE_DIR="src-tauri/target/release/bundle"
if [ ! -d "$BUNDLE_DIR" ]; then
  echo "Building..."
  npm run tauri build
fi

# ── Collect artifacts ─────────────────────────────────────────────────────────
DIST="dist-r2"
rm -rf "$DIST" && mkdir -p "$DIST"

collect() {
  local src="$1" dest="$2"
  if [ -f "$src" ]; then
    cp "$src" "$DIST/$dest"
    sha256sum "$DIST/$dest" | awk '{print $1}' > "$DIST/${dest}.sha256"
    echo "  + $dest"
  fi
}

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

if [ "$OS" = "linux" ]; then
  collect "$(find $BUNDLE_DIR/appimage -name '*.AppImage' 2>/dev/null | head -1)" \
          "amoon-launcher-${VERSION}-linux-${ARCH}.AppImage"
  collect "$(find $BUNDLE_DIR/deb -name '*.deb' 2>/dev/null | head -1)" \
          "amoon-launcher-${VERSION}-linux-${ARCH}.deb"

  # tar.gz cho install.sh
  mkdir -p /tmp/amoon-pkg
  cp src-tauri/target/release/mc-launcher /tmp/amoon-pkg/amoon-launcher 2>/dev/null || true
  tar -czf "$DIST/amoon-launcher-${VERSION}-linux-${ARCH}.tar.gz" -C /tmp/amoon-pkg .
  sha256sum "$DIST/amoon-launcher-${VERSION}-linux-${ARCH}.tar.gz" | awk '{print $1}' \
    > "$DIST/amoon-launcher-${VERSION}-linux-${ARCH}.tar.gz.sha256"

elif [ "$OS" = "darwin" ]; then
  collect "$(find $BUNDLE_DIR/dmg -name '*.dmg' 2>/dev/null | head -1)" \
          "amoon-launcher-${VERSION}-macos-${ARCH}.dmg"
fi

echo ""
echo "Artifacts:"
ls -lh "$DIST/"

# ── Upload ────────────────────────────────────────────────────────────────────
echo ""
echo "Uploading to R2 bucket: $R2_BUCKET"

# Versioned artifacts
aws s3 cp "$DIST/" "s3://${R2_BUCKET}/releases/${VERSION}/" \
  --recursive --endpoint-url "$ENDPOINT" --no-progress

# latest.txt
echo "$VERSION" | aws s3 cp - "s3://${R2_BUCKET}/releases/latest.txt" \
  --content-type "text/plain" --endpoint-url "$ENDPOINT"

# Install scripts (update tại root)
aws s3 cp scripts/install.sh  "s3://${R2_BUCKET}/install.sh"  \
  --content-type "text/x-sh"  --endpoint-url "$ENDPOINT"
aws s3 cp scripts/install.ps1 "s3://${R2_BUCKET}/install.ps1" \
  --content-type "text/plain" --endpoint-url "$ENDPOINT"

echo ""
echo "Done! Published v${VERSION}"
echo ""
echo "Linux install:   curl -fsSL https://cdn-rcf.anhcong.dev/install.sh | bash"
echo "Windows install: irm https://cdn-rcf.anhcong.dev/install.ps1 | iex"
echo ""
echo "Direct links:"
aws s3 ls "s3://${R2_BUCKET}/releases/${VERSION}/" --endpoint-url "$ENDPOINT"
