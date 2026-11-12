// Regenerates the installed-app and notification icons from the vector logo.
// Run: node scripts/generate-app-icons.mjs
//
// Design "Line": the full-colour logo on a soft white tile. The diamond's grey fill is
// removed so only its navy outline frames the Z and the mountains.
import sharp from "sharp";
import { readFileSync } from "node:fs";

const logo = readFileSync(new URL("../public/images/logo-no-text-light.svg", import.meta.url), "utf8");
const out = (name) => new URL(`../public/images/${name}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// The logo's defs and artwork (500×500 drawing space), without the diamond's grey fill.
const fill = /<path class="st8" d="[^"]+"\/>/;
if (!fill.test(logo)) throw new Error("Logo structure changed: update the diamond-fill selector in generate-app-icons.mjs");
const artwork = logo.slice(logo.indexOf("<defs>"), logo.lastIndexOf("</svg>")).replace(fill, "");

const CANVAS = 1024;
const icon = (markShare) => {
  const mark = CANVAS * markShare, offset = (CANVAS - mark) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <defs><linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f4f5fb"/></linearGradient></defs>
  <rect width="${CANVAS}" height="${CANVAS}" fill="url(#tile)"/>
  <svg x="${offset}" y="${offset}" width="${mark}" height="${mark}" viewBox="0 0 500 500">${artwork}</svg>
</svg>`;
};

const square = (size, markShare = 0.78) => sharp(Buffer.from(icon(markShare)), { density: 300 }).resize(size, size).png({ compressionLevel: 9 });
// Rounded square (iOS-style corner ratio) with transparent corners, for desktops and browser tabs.
const rounded = async (size) => sharp(await square(size).toBuffer())
  .composite([{ input: Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * 0.2237}" fill="#fff"/></svg>`), blend: "dest-in" }])
  .png({ compressionLevel: 9 });

// "any": rounded square (Windows/macOS install, browser tabs, notification icon).
await (await rounded(192)).toFile(out("icon-192.png"));
await (await rounded(512)).toFile(out("icon-512.png"));
// "maskable": full bleed; Android crops it to its own shape. The diamond's tips stay inside
// the 80% safe-zone circle.
await square(192, 0.76).toFile(out("icon-maskable-192.png"));
await square(512, 0.76).toFile(out("icon-maskable-512.png"));
// iOS rounds the corners itself and shows transparency as black, so a full, opaque square.
await square(180).flatten({ background: "#ffffff" }).toFile(out("apple-touch-icon.png"));

// Android status-bar badge: only the alpha channel is used, so a white mark on transparency.
// A rounded diamond (the logo's outline) with the Z cut out, legible at 24dp.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <defs><mask id="z"><rect width="96" height="96" fill="#fff"/>
    <path d="M35 33h28v6.5L44.5 58H63v6.5H33V58l18.5-18.5H35z" fill="#000"/></mask></defs>
  <g mask="url(#z)"><rect x="20" y="20" width="56" height="56" rx="14" transform="rotate(45 48 48)" fill="#fff"/></g>
</svg>`;
await sharp(Buffer.from(badge)).resize(96, 96).png({ compressionLevel: 9 }).toFile(out("notification-badge.png"));
console.log("App icons generated.");
