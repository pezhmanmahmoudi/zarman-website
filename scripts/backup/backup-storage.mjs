#!/usr/bin/env node
// Read-only, per-file verified backup of Supabase Storage (list + download only; nothing is written to Supabase).
//
//   node backup-storage.mjs --inventory <storage-inventory.json> --out <folder> [--env <.env file>]
//   node backup-storage.mjs --list-only [--env <.env file>]
//
// --inventory is the authoritative list exported from storage.buckets / storage.objects by
// Backup-ZarmanProduction.ps1. Every object in it must:
//   * appear in the Storage API listing with the same size, ETag and content type (and nothing extra may appear),
//   * download to exactly `size` bytes,
//   * have MD5(content) equal to its ETag (Supabase records the MD5 for single-part uploads),
//   * be served with the recorded content type,
//   * read back from disk with the same SHA-256 that was computed in memory.
// Any failure makes the run fail (exit code 2). Object paths never appear on stdout; they stay in the
// manifest, which the caller encrypts.
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

const listOnly = flag("--list-only");
const outDir = option("--out");
const inventoryFile = option("--inventory");
const envFile = option("--env") ?? path.join(repoRoot, ".env.local");
const CONCURRENCY = 4;
const PAGE = 1000;

function fail(message, code = 1) {
  console.error(`[storage-backup] ${message}`);
  process.exit(code);
}

function readEnv(file) {
  if (!existsSync(file)) fail(`Environment file not found: ${file}`);
  const values = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) values[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

const normalizeEtag = (etag) => (typeof etag === "string" ? etag.trim().replace(/^W\//, "").replace(/^"|"$/g, "").toLowerCase() : null);
const isMd5 = (etag) => /^[0-9a-f]{32}$/.test(etag ?? "");
const normalizeType = (type) => (typeof type === "string" ? type.trim().toLowerCase() : "");

// Storage names may contain characters Windows cannot store in a file name. Such characters (and "%"
// itself) are percent-encoded as UTF-8 bytes, so the stored name is reversible; a trailing dot/space and
// reserved device names (CON, NUL, COM1, ...) are encoded the same way. The manifest keeps the original name.
const pct = (s) => [...Buffer.from(s, "utf8")].map((b) => "%" + b.toString(16).toUpperCase().padStart(2, "0")).join("");
function encodeSegment(segment) {
  if (segment === "") throw new Error("unsafe_path");
  let out = [...segment].map((ch) => (/[<>:"|?*\\%\x00-\x1f]/.test(ch) ? pct(ch) : ch)).join("");
  if (/[. ]$/.test(out)) out = out.slice(0, -1) + pct(out.slice(-1));
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(out)) out = pct(out[0]) + out.slice(1);
  return out;
}
const MAX_WINDOWS_PATH = 250;

/** Maps bucket/name to a path under root that is valid on Windows and cannot escape root. */
function safeTarget(root, bucket, objectName) {
  const parts = [encodeSegment(bucket), ...objectName.split("/").map(encodeSegment)];
  const target = path.resolve(root, ...parts);
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error("unsafe_path");
  if (target.length > MAX_WINDOWS_PATH) throw new Error("path_too_long");
  return target;
}

async function withRetry(work, attempts = 3) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      const result = await work();
      if (result && result.error) throw result.error;
      return result;
    } catch (error) { last = error; await new Promise((r) => setTimeout(r, 400 * i)); }
  }
  throw last;
}

async function listBucket(storage, bucket, prefix, into) {
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await withRetry(() => storage.from(bucket).list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } }));
    for (const item of data ?? []) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null || item.id === undefined) await listBucket(storage, bucket, full, into);
      else into.set(`${bucket}/${full}`, { bucket, name: full, size: Number(item.metadata?.size), etag: normalizeEtag(item.metadata?.eTag), mimetype: item.metadata?.mimetype ?? null });
    }
    if ((data?.length ?? 0) < PAGE) return into;
  }
}

async function main() {
  const env = readEnv(envFile);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment file.");
  const { storage } = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: apiBuckets } = await withRetry(() => storage.listBuckets());
  const listed = new Map();
  for (const b of apiBuckets) await listBucket(storage, b.id, "", listed);

  if (listOnly) {
    const perBucket = {};
    for (const o of listed.values()) { perBucket[o.bucket] ??= { objects: 0, bytes: 0 }; perBucket[o.bucket].objects++; perBucket[o.bucket].bytes += o.size || 0; }
    console.log(JSON.stringify({ mode: "list-only", buckets: perBucket, objects: listed.size }));
    return;
  }
  if (!inventoryFile || !outDir) fail("Pass --inventory <file> and --out <folder> (or --list-only).");

  const inventory = JSON.parse((await readFile(inventoryFile, "utf8")).replace(/^﻿/, ""));
  const failures = [];
  const warnings = [];
  const addFailure = (reason, o) => failures.push({ reason, bucket: o?.bucket ?? null, name: o?.name ?? null });

  // Buckets: same set and visibility as storage.buckets.
  const apiBucketMap = new Map(apiBuckets.map((b) => [b.id, b]));
  for (const b of inventory.buckets) {
    const api = apiBucketMap.get(b.id);
    if (!api) addFailure("bucket_missing_from_api", { bucket: b.id });
    else if (Boolean(api.public) !== Boolean(b.public)) addFailure("bucket_visibility_differs", { bucket: b.id });
  }
  for (const id of apiBucketMap.keys()) if (!inventory.buckets.some((b) => b.id === id)) addFailure("bucket_not_in_database", { bucket: id });

  // Listing vs database inventory: same objects, same metadata.
  const expected = new Map(inventory.objects.map((o) => [`${o.bucket}/${o.name}`, { ...o, etag: normalizeEtag(o.etag) }]));
  for (const [k, o] of expected) {
    const l = listed.get(k);
    if (!l) { addFailure("object_missing_from_api_listing", o); continue; }
    if (l.size !== Number(o.size)) addFailure("listing_size_differs", o);
    if (l.etag !== o.etag) addFailure("listing_etag_differs", o);
    if (normalizeType(l.mimetype) !== normalizeType(o.mimetype)) addFailure("listing_content_type_differs", o);
  }
  for (const [k, l] of listed) if (!expected.has(k)) addFailure("object_not_in_database", l);

  // Download and verify every object.
  const root = path.resolve(outDir);
  await mkdir(path.join(root, "files"), { recursive: true });
  const results = [];
  const queue = [...expected.values()];
  let next = 0;
  async function worker() {
    while (next < queue.length) {
      const o = queue[next++];
      const record = { bucket: o.bucket, name: o.name, size: Number(o.size), etag: o.etag, mimetype: o.mimetype, updated_at: o.updated_at, verified: false };
      results.push(record);
      try {
        const target = safeTarget(path.join(root, "files"), o.bucket, o.name);
        record.stored_as = path.relative(root, target).split(path.sep).join("/");
        // storage-js does not URL-encode the object path, so "?", "#" or "%" in a name would break the
        // request. Encoding each segment is identical to what fetch already sends for ordinary names.
        const urlPath = o.name.split("/").map(encodeURIComponent).join("/");
        const { data: blob } = await withRetry(() => storage.from(o.bucket).download(urlPath));
        const bytes = Buffer.from(await blob.arrayBuffer());
        record.md5 = createHash("md5").update(bytes).digest("hex");
        record.sha256 = createHash("sha256").update(bytes).digest("hex");
        record.downloaded_bytes = bytes.length;
        record.served_type = blob.type || null;
        const problems = [];
        if (bytes.length !== Number(o.size)) problems.push("size_mismatch");
        if (isMd5(o.etag)) { if (record.md5 !== o.etag) problems.push("md5_etag_mismatch"); }
        else { warnings.push({ reason: "etag_not_md5_size_and_listing_verified_only", bucket: o.bucket, name: o.name }); }
        if (normalizeType(blob.type) !== normalizeType(o.mimetype)) problems.push("content_type_mismatch");
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, bytes, { flag: "wx" });
        const reread = createHash("sha256").update(await readFile(target)).digest("hex");
        if (reread !== record.sha256) problems.push("disk_readback_mismatch");
        record.checks = problems.length ? problems : ["size", isMd5(o.etag) ? "md5=etag" : "size-only", "content_type", "disk_sha256"];
        if (problems.length) problems.forEach((p) => addFailure(p, o)); else record.verified = true;
      } catch (cause) {
        const reason = cause instanceof Error && cause.message === "unsafe_path" ? "unsafe_object_path"
          : cause instanceof Error && cause.message === "path_too_long" ? "path_too_long_use_shorter_OutputRoot_eg_C_ZB"
          : "download_failed";
        addFailure(reason, o);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  results.sort((a, b) => `${a.bucket}/${a.name}`.localeCompare(`${b.bucket}/${b.name}`));

  const perBucket = {};
  for (const b of inventory.buckets) perBucket[b.id] = { objects: 0, verified: 0, bytes: 0 };
  for (const r of results) {
    perBucket[r.bucket] ??= { objects: 0, verified: 0, bytes: 0 };
    perBucket[r.bucket].objects++;
    if (r.verified) { perBucket[r.bucket].verified++; perBucket[r.bucket].bytes += r.downloaded_bytes; }
  }
  const verified = results.filter((r) => r.verified).length;
  const manifest = {
    created_at: new Date().toISOString(),
    project_ref: new URL(url).hostname.split(".")[0],
    buckets: inventory.buckets,
    totals: { expected: expected.size, listed: listed.size, verified, bytes: results.reduce((s, r) => s + (r.verified ? r.downloaded_bytes : 0), 0) },
    failures, warnings, objects: results,
  };
  await writeFile(path.join(root, "storage-manifest.json"), JSON.stringify(manifest, null, 2));

  const reasons = {};
  for (const f of failures) reasons[f.reason] = (reasons[f.reason] ?? 0) + 1;
  console.log(JSON.stringify({ mode: "download", expected: expected.size, listed: listed.size, verified, failed: failures.length, warnings: warnings.length, bytes: manifest.totals.bytes, buckets: perBucket, failure_reasons: reasons }));
  if (failures.length || verified !== expected.size) process.exit(2);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
