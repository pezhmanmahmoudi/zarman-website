// Minimal stand-in for the Supabase Storage API used by Test-BackupKit.ps1 (synthetic files only).
// Implements the three endpoints storage-js uses: GET /storage/v1/bucket,
// POST /storage/v1/object/list/:bucket and GET /storage/v1/object/:bucket/:path.
//   node mock-storage-server.mjs --fixture <json> [--tamper bucket/name] [--extra bucket/name]
// Prints "LISTENING <port>" once ready.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";

const args = process.argv.slice(2);
const option = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const fixture = JSON.parse(readFileSync(option("--fixture"), "utf8"));
const tamper = option("--tamper");
const extra = option("--extra");

const objects = fixture.objects.map((o) => {
  const bytes = Buffer.from(o.base64, "base64");
  return { ...o, bytes, size: bytes.length, etag: `"${createHash("md5").update(bytes).digest("hex")}"`, id: o.id };
});
if (extra) {
  const [bucket, ...rest] = extra.split("/");
  const bytes = Buffer.from("not in the database inventory");
  objects.push({ bucket, name: rest.join("/"), bytes, size: bytes.length, mimetype: "text/plain", etag: `"${createHash("md5").update(bytes).digest("hex")}"`, id: "00000000-0000-4000-8000-0000000e0000" });
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": type });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

const server = http.createServer(async (req, res) => {
  if (!req.headers.authorization && !req.headers.apikey) return send(res, 401, { message: "missing credentials" });
  const url = new URL(req.url, "http://localhost");
  const p = decodeURIComponent(url.pathname);
  if (req.method === "GET" && p === "/storage/v1/bucket") {
    return send(res, 200, fixture.buckets.map((b) => ({ id: b.id, name: b.id, public: b.public, created_at: "2026-01-01T00:00:00Z" })));
  }
  const list = p.match(/^\/storage\/v1\/object\/list\/([^/]+)$/);
  if (req.method === "POST" && list) {
    let raw = ""; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || "{}");
    const prefix = (body.prefix || "").replace(/\/$/, "");
    const level = new Map();
    for (const o of objects.filter((x) => x.bucket === list[1])) {
      if (prefix && !o.name.startsWith(prefix + "/")) continue;
      const rest = prefix ? o.name.slice(prefix.length + 1) : o.name;
      const [head, ...tail] = rest.split("/");
      if (tail.length) level.set(head, { name: head, id: null, metadata: null });
      else level.set(head, { name: head, id: o.id, updated_at: "2026-11-13T00:00:00Z",
        metadata: { size: o.size, mimetype: o.mimetype, eTag: o.etag, contentLength: o.size, cacheControl: "max-age=3600" } });
    }
    const items = [...level.values()].sort((a, b) => a.name.localeCompare(b.name));
    const offset = body.offset || 0, limit = body.limit || 100;
    return send(res, 200, items.slice(offset, offset + limit));
  }
  const obj = p.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/);
  if (req.method === "GET" && obj) {
    const o = objects.find((x) => x.bucket === obj[1] && x.name === obj[2]);
    if (!o) return send(res, 404, { message: "not found" });
    let bytes = o.bytes;
    if (tamper === `${o.bucket}/${o.name}`) { bytes = Buffer.from(bytes); bytes[0] ^= 0xff; }
    res.writeHead(200, { "Content-Type": o.mimetype, "Content-Length": bytes.length, ETag: o.etag });
    return res.end(bytes);
  }
  send(res, 404, { message: `no route ${req.method} ${p}` });
});
server.listen(0, "127.0.0.1", () => console.log(`LISTENING ${server.address().port}`));
