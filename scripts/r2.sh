#!/usr/bin/env bash
# r2.sh — upload từng file lẻ lên R2, đơn giản nhất có thể
# Usage:
#   ./scripts/r2.sh put path/to/file.txt             → upload vào root bucket
#   ./scripts/r2.sh put path/to/file.txt releases/   → upload vào folder
#   ./scripts/r2.sh ls [prefix]                      → list files
#   ./scripts/r2.sh rm releases/v0.1.0/file.txt      → xóa file
#   ./scripts/r2.sh url releases/v0.1.0/file.txt     → lấy public URL

set -euo pipefail

# Load .env.r2
if [ -f ".env.r2" ]; then set -a; source .env.r2; set +a; fi

: "${R2_ACCESS_KEY_ID:?Thiếu R2_ACCESS_KEY_ID trong .env.r2}"
: "${R2_SECRET_ACCESS_KEY:?Thiếu R2_SECRET_ACCESS_KEY trong .env.r2}"
: "${R2_ACCOUNT_ID:?Thiếu R2_ACCOUNT_ID trong .env.r2}"
: "${R2_BUCKET:=amoon-cdn}"
: "${R2_PUBLIC_URL:=https://cdn.amoon.app}"

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

CMD="${1:-help}"
shift || true

case "$CMD" in

  # ── Upload 1 file ──────────────────────────────────────────────────────────
  put|up|upload)
    FILE="${1:?Cần path file: r2.sh put <file> [dest/]}"
    DEST="${2:-}"

    # Nếu dest là folder (kết thúc /) thì giữ tên file gốc
    if [ -z "$DEST" ]; then
      KEY="$(basename "$FILE")"
    elif [[ "$DEST" == */ ]]; then
      KEY="${DEST}$(basename "$FILE")"
    else
      KEY="$DEST"
    fi

    # Guess content-type
    CT="application/octet-stream"
    case "$FILE" in
      *.sh)       CT="text/x-sh" ;;
      *.ps1)      CT="text/plain" ;;
      *.html)     CT="text/html" ;;
      *.txt)      CT="text/plain" ;;
      *.json)     CT="application/json" ;;
      *.png)      CT="image/png" ;;
      *.ico)      CT="image/x-icon" ;;
      *.AppImage) CT="application/octet-stream" ;;
      *.deb)      CT="application/vnd.debian.binary-package" ;;
      *.tar.gz)   CT="application/gzip" ;;
      *.zip)      CT="application/zip" ;;
      *.exe|*.msi) CT="application/octet-stream" ;;
    esac

    SIZE=$(du -h "$FILE" | cut -f1)
    echo "Uploading $FILE ($SIZE) → s3://$R2_BUCKET/$KEY"

    aws s3 cp "$FILE" "s3://${R2_BUCKET}/${KEY}" \
      --content-type "$CT" \
      --endpoint-url "$ENDPOINT" \
      --no-progress

    # Tự gen sha256
    SHA=$(sha256sum "$FILE" | awk '{print $1}')
    echo "$SHA" | aws s3 cp - "s3://${R2_BUCKET}/${KEY}.sha256" \
      --content-type "text/plain" \
      --endpoint-url "$ENDPOINT"

    echo "Done! Public URL:"
    echo "  ${R2_PUBLIC_URL}/${KEY}"
    ;;

  # ── List files ─────────────────────────────────────────────────────────────
  ls|list)
    PREFIX="${1:-}"
    aws s3 ls "s3://${R2_BUCKET}/${PREFIX}" \
      --endpoint-url "$ENDPOINT" \
      --human-readable
    ;;

  # ── Delete file ────────────────────────────────────────────────────────────
  rm|del|delete)
    KEY="${1:?Cần key: r2.sh rm <key>}"
    echo "Deleting s3://$R2_BUCKET/$KEY ..."
    aws s3 rm "s3://${R2_BUCKET}/${KEY}" --endpoint-url "$ENDPOINT"
    echo "Done"
    ;;

  # ── Get public URL ─────────────────────────────────────────────────────────
  url)
    KEY="${1:?Cần key: r2.sh url <key>}"
    echo "${R2_PUBLIC_URL}/${KEY}"
    ;;

  # ── Upload install scripts ─────────────────────────────────────────────────
  scripts)
    echo "Uploading install scripts..."
    "$0" put scripts/install.sh  install.sh
    "$0" put scripts/install.ps1 install.ps1
    ;;

  # ── Help ───────────────────────────────────────────────────────────────────
  *)
    echo "r2.sh — Cloudflare R2 uploader"
    echo ""
    echo "Usage:"
    echo "  ./scripts/r2.sh put <file> [dest/folder/]   upload file"
    echo "  ./scripts/r2.sh ls [prefix]                 list files"
    echo "  ./scripts/r2.sh rm <key>                    delete file"
    echo "  ./scripts/r2.sh url <key>                   get public URL"
    echo "  ./scripts/r2.sh scripts                     upload install.sh + install.ps1"
    echo ""
    echo "Config: .env.r2"
    echo "  R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID, R2_BUCKET, R2_PUBLIC_URL"
    ;;
esac
