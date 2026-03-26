#!/usr/bin/env node
// r2.mjs — upload file lên Cloudflare R2
// Usage:
//   node scripts/r2.mjs put <file> [dest/key]
//   node scripts/r2.mjs ls [prefix]
//   node scripts/r2.mjs rm <key>
//   node scripts/r2.mjs scripts   ← upload install.sh + install.ps1

import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "./node_modules/@aws-sdk/client-s3/dist-cjs/index.js";
import { readFileSync, createReadStream, statSync } from "fs";
import { basename, extname } from "path";
import { createHash } from "crypto";

// ── Load .env.r2 ──────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const lines = readFileSync(".env.r2", "utf8").split("\n");
    for (const line of lines) {
      const [k, v] = line.split("=");
      if (k && v) process.env[k.trim()] = v.trim();
    }
  } catch {}
}
loadEnv();

const {
  R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
  R2_ACCOUNT_ID, R2_BUCKET = "amoon-launcher",
  R2_PUBLIC_URL = `https://pub-${R2_ACCOUNT_ID}.r2.dev`,
} = process.env;

if (!R2_ACCESS_KEY_ID || !R2_ACCOUNT_ID) {
  console.error("Thiếu R2_ACCESS_KEY_ID hoặc R2_ACCOUNT_ID trong .env.r2");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function getContentType(file) {
  const ext = extname(file).toLowerCase();
  const map = {
    ".sh": "text/x-sh", ".ps1": "text/plain", ".txt": "text/plain",
    ".html": "text/html", ".json": "application/json",
    ".png": "image/png", ".ico": "image/x-icon",
    ".tar.gz": "application/gzip", ".gz": "application/gzip",
    ".zip": "application/zip", ".deb": "application/vnd.debian.binary-package",
    ".exe": "application/octet-stream", ".msi": "application/octet-stream",
    ".AppImage": "application/octet-stream",
  };
  return map[ext] || "application/octet-stream";
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function humanSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + " MB";
  return (bytes / 1024 ** 3).toFixed(1) + " GB";
}

// ── Commands ──────────────────────────────────────────────────────────────────
const [,, cmd, ...args] = process.argv;

if (!cmd || cmd === "help") {
  console.log(`r2.mjs — Cloudflare R2 uploader

  node scripts/r2.mjs put <file> [dest/key]    upload file
  node scripts/r2.mjs ls [prefix]              list files
  node scripts/r2.mjs rm <key>                 delete file
  node scripts/r2.mjs scripts                  upload install.sh + install.ps1`);
  process.exit(0);
}

// ── PUT ───────────────────────────────────────────────────────────────────────
if (cmd === "put" || cmd === "up" || cmd === "upload") {
  const file = args[0];
  if (!file) { console.error("Cần path file"); process.exit(1); }

  let dest = args[1] || "";
  let key = dest
    ? (dest.endsWith("/") ? dest + basename(file) : dest)
    : basename(file);

  const stat = statSync(file);
  const ct   = getContentType(file);
  console.log(`Uploading ${file} (${humanSize(stat.size)}) → ${key}`);

  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key:    key,
    Body:   createReadStream(file),
    ContentType: ct,
    ContentLength: stat.size,
  }));

  // Upload sha256 sidecar
  const sha = sha256File(file);
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key:    key + ".sha256",
    Body:   sha,
    ContentType: "text/plain",
  }));

  console.log(`✓ Done`);
  console.log(`  URL: ${R2_PUBLIC_URL}/${key}`);
}

// ── LS ────────────────────────────────────────────────────────────────────────
else if (cmd === "ls" || cmd === "list") {
  const prefix = args[0] || "";
  const res = await s3.send(new ListObjectsV2Command({
    Bucket: R2_BUCKET,
    Prefix: prefix,
  }));
  const items = (res.Contents || []).filter(o => !o.Key.endsWith(".sha256"));
  if (!items.length) { console.log("(empty)"); }
  else {
    for (const obj of items) {
      console.log(`  ${humanSize(obj.Size).padStart(8)}  ${obj.Key}`);
    }
  }
}

// ── RM ────────────────────────────────────────────────────────────────────────
else if (cmd === "rm" || cmd === "del") {
  const key = args[0];
  if (!key) { console.error("Cần key"); process.exit(1); }
  await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  console.log(`✓ Deleted: ${key}`);
}

// ── SCRIPTS ───────────────────────────────────────────────────────────────────
else if (cmd === "scripts") {
  for (const [src, dest] of [["scripts/install.sh", "install.sh"], ["scripts/install.ps1", "install.ps1"]]) {
    try {
      const stat = statSync(src);
      await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET, Key: dest,
        Body: createReadStream(src),
        ContentType: src.endsWith(".sh") ? "text/x-sh" : "text/plain",
        ContentLength: stat.size,
      }));
      console.log(`✓ ${src} → ${dest}`);
      console.log(`  ${R2_PUBLIC_URL}/${dest}`);
    } catch (e) { console.error(`✗ ${src}: ${e.message}`); }
  }
}

else {
  console.error(`Unknown command: ${cmd}`);
  process.exit(1);
}
