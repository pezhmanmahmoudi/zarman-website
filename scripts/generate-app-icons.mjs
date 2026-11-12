// Regenerates the installed-app and notification icons from the vector logo.
// Run: node scripts/generate-app-icons.mjs
//
// Desktop (Windows/macOS install, notifications): the logo itself on a transparent background.
// Phones (iPhone Home Screen, Android): the same logo, light diamond included, on a deep-navy
// tile with a soft brand glow.
import sharp from "sharp";
import { readFileSync } from "node:fs";

const logo = readFileSync(new URL("../public/images/logo-no-text-light.svg", import.meta.url), "utf8");
const out = (name) => new URL(`../public/images/${name}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const logoBody = logo.slice(logo.indexOf("<defs>"), logo.lastIndexOf("</svg>"));
const darkArtwork = logoBody;

const CANVAS = 1024;
const place = (artwork, share) => {
  const mark = CANVAS * share, offset = (CANVAS - mark) / 2;
  return `<svg x="${offset}" y="${offset}" width="${mark}" height="${mark}" viewBox="0 0 500 500">${artwork}</svg>`;
};

// Desktop: logo only, transparent around it.
const plain = (size) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}">${place(logoBody, 0.98)}</svg>`), { density: 300 })
  .resize(size, size).png({ compressionLevel: 9 });

// Phones: "deep sapphire". Each layer has a job:
//   sapphire → deep navy gradient: trust and competence, settling into a stable, weighty base;
//   blue glow behind the diamond: lifts the logo off the background;
//   teal in the lower corner: movement and growth, echoing the Z's cyan;
//   soft white sheen from the top left: clarity, one consistent light source.
// No purple (reads as luxury/mystery), black (heavy) or warm reds (alarm) for a money app.
const tile = (share) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="#0f3a8a"/><stop offset=".5" stop-color="#0a2560"/><stop offset="1" stop-color="#06163d"/></linearGradient>
    <radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#4f8cff" stop-opacity=".4"/><stop offset=".6" stop-color="#4f8cff" stop-opacity=".12"/><stop offset="1" stop-color="#4f8cff" stop-opacity="0"/></radialGradient>
    <radialGradient id="teal" cx="1" cy="1" r=".75"><stop offset="0" stop-color="#2ad4c4" stop-opacity=".26"/><stop offset="1" stop-color="#2ad4c4" stop-opacity="0"/></radialGradient>
    <radialGradient id="sheen" cx=".15" cy="0" r=".85"><stop offset="0" stop-color="#ffffff" stop-opacity=".14"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${CANVAS}" height="${CANVAS}" fill="url(#base)"/>
  <rect width="${CANVAS}" height="${CANVAS}" fill="url(#teal)"/>
  <circle cx="${CANVAS / 2}" cy="${CANVAS / 2}" r="${CANVAS * 0.5}" fill="url(#glow)"/>
  <rect width="${CANVAS}" height="${CANVAS}" fill="url(#sheen)"/>
  ${place(darkArtwork, share)}
</svg>`;
const dark = (size, share) => sharp(Buffer.from(tile(share)), { density: 300 }).resize(size, size).png({ compressionLevel: 9 });

// "any": Windows/macOS install, browser UI, notification icon.
await plain(192).toFile(out("icon-192.png"));
await plain(512).toFile(out("icon-512.png"));
// "maskable": Android crops it to its own shape; the diamond's tips stay inside the 80% safe zone.
await dark(192, 0.84).toFile(out("icon-maskable-192.png"));
await dark(512, 0.84).toFile(out("icon-maskable-512.png"));
// iPhone rounds the corners itself and needs an opaque square.
await dark(180, 0.96).flatten({ background: "#0a2560" }).toFile(out("apple-touch-icon.png"));

// Android status-bar badge: only the alpha channel is used, so a white mark on transparency.
// A rounded diamond (the logo's outline) with the Z cut out, legible at 24dp.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <defs><mask id="z"><rect width="96" height="96" fill="#fff"/>
    <path d="M35 33h28v6.5L44.5 58H63v6.5H33V58l18.5-18.5H35z" fill="#000"/></mask></defs>
  <g mask="url(#z)"><rect x="20" y="20" width="56" height="56" rx="14" transform="rotate(45 48 48)" fill="#fff"/></g>
</svg>`;
await sharp(Buffer.from(badge)).resize(96, 96).png({ compressionLevel: 9 }).toFile(out("notification-badge.png"));
console.log("App icons generated.");
