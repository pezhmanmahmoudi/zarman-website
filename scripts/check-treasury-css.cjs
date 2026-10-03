#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- Read-only compiled-asset check. */
/**
 * Check CSS actually registered for the Treasury route, including parent layouts.
 * Compile the route first (visit it in dev, or run npm run build).
 *
 *   node scripts/check-treasury-css.cjs --dev --base-url http://localhost:3000
 *   node scripts/check-treasury-css.cjs --production
 *
 * An optional local origin also checks served assets, without logging in or reading
 * financial data. This complements source-render tests; it is not a visual test.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const vm = require("node:vm");
const postcss = require("postcss");

const projectRoot = path.resolve(__dirname, "..");
const route = "app/(panel)/admin/(protected)/treasury";
const routeEntries = new Set([
  "app/layout", "app/(panel)/layout", "app/(panel)/admin/layout",
  "app/(panel)/admin/(protected)/layout", `${route}/layout`, `${route}/page`,
]);
const requiredRules = [
  ["TreasuryWorkspace", "routeFrame", "display", "flex"],
  ["TreasuryWorkspace", "workspace", "display", "flex"],
  ["TreasuryWorkspace", "navigation", "display", "flex"],
  ["TreasuryWorkspace", "panelHeader", "display", "flex"],
  ["TreasuryWorkspace", "subnav", "display", "flex"],
  ["TreasuryWorkspace", "metrics", "display", "grid"],
  ["TreasuryWorkspace", "metric", "display", "flex"],
  ["TreasuryWorkspace", "attention", "display", "flex"],
  ["TreasuryWorkspace", "quickGrid", "display", "grid"],
  ["TreasuryWorkspace", "quickLink", "display", "flex"],
  ["TreasuryWorkspace", "insight", "display", "flex"],
  ["TreasuryWorkspace", "criticalAlertBadge", "display", "inline-flex"],
];

function readOptions(args) {
  let mode = "production";
  let explicitMode;
  let baseUrl;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dev" || args[i] === "--production") {
      assert.ok(!explicitMode, "Supply only one build mode: --dev or --production.");
      explicitMode = true;
      mode = args[i].slice(2);
    } else if (args[i] === "--base-url") {
      assert.ok(!baseUrl && args[i + 1], "Supply --base-url once, followed by a local HTTP(S) origin.");
      baseUrl = new URL(args[++i]);
      assert.ok(
        ["http:", "https:"].includes(baseUrl.protocol)
          && ["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname)
          && baseUrl.pathname === "/" && !baseUrl.search && !baseUrl.hash
          && !baseUrl.username && !baseUrl.password,
        "--base-url must be a local HTTP(S) origin, e.g. http://localhost:3000.",
      );
    } else {
      throw new Error(`Unknown argument: ${args[i]}`);
    }
  }
  return { mode, baseUrl };
}

function routeEntry(key) {
  const normalized = key.replaceAll("\\", "/");
  const appIndex = normalized.lastIndexOf("/app/");
  return appIndex >= 0 ? normalized.slice(appIndex + 1) : normalized;
}

function assetPath(buildRoot, emittedPath) {
  assert.equal(typeof emittedPath, "string", "CSS manifest entry needs a path.");
  assert.match(emittedPath, /^static\/(?:css|chunks)\/.+\.css$/, `Unexpected CSS asset path: ${emittedPath}`);
  const resolved = path.resolve(buildRoot, emittedPath);
  const relative = path.relative(buildRoot, resolved);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "CSS asset escaped the build directory.");
  return resolved;
}

function inspectStyles(assets, label, expectedClasses) {
  const rules = [];
  for (const asset of assets) {
    assert.ok(asset.css.trim(), `${label}: empty CSS asset ${asset.path}`);
    assert.doesNotMatch(asset.css.trimStart(), /^(?:<!doctype\s+html|<html)\b/i, `${label}: HTML returned for ${asset.path}`);
    postcss.parse(asset.css, { from: asset.path }).walkRules(rule => {
      const classes = [...rule.selector.matchAll(/\.([A-Za-z_][\w-]*)/g)].map(match => match[1]);
      rules.push({ classes, declarations: rule.nodes.filter(node => node.type === "decl") });
    });
  }

  const checkedClasses = new Set();
  for (const [moduleName, localName, property, value] of requiredRules) {
    // Next Webpack and Turbopack use different scoped class-name formats.
    const scoped = new RegExp(`^(?:${moduleName}_${localName}__[\\w-]+|${moduleName}-module__[\\w-]+__${localName})$`);
    const matchingRules = rules.filter(rule => rule.classes.some(className => scoped.test(className)));
    assert.ok(matchingRules.length, `${label}: missing scoped ${moduleName}.${localName} rule in registered route CSS.`);
    assert.ok(
      matchingRules.some(rule => rule.declarations.some(declaration => declaration.prop === property && declaration.value === value)),
      `${label}: ${moduleName}.${localName} is missing ${property}: ${value}.`,
    );
    for (const rule of matchingRules) {
      for (const className of rule.classes.filter(className => scoped.test(className))) checkedClasses.add(className);
    }
  }
  for (const className of expectedClasses ?? []) {
    assert.ok(checkedClasses.has(className), `${label}: served CSS is missing compiled class ${className}; check stale build assets.`);
  }
  return checkedClasses;
}

async function main() {
  const { mode, baseUrl } = readOptions(process.argv.slice(2));
  const buildRoot = path.join(projectRoot, ".next", mode === "dev" ? "dev" : "");
  const manifestFile = path.join(buildRoot, "server", route, "page_client-reference-manifest.js");
  let source;
  try {
    source = await fs.readFile(manifestFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(`Treasury ${mode} manifest is missing. ${mode === "dev" ? "Open /admin/treasury in the running dev server first." : "Run npm run build first."}`);
    throw error;
  }

  // Evaluate only the local build manifest, in an isolated context without Node
  // globals, dynamic code generation, or an unbounded execution time.
  const context = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
  new vm.Script(source, { filename: manifestFile }).runInContext(context, { timeout: 1000 });
  const manifest = context.__RSC_MANIFEST?.["/(panel)/admin/(protected)/treasury/page"];
  assert.ok(manifest?.entryCSSFiles, "Treasury client-reference manifest has no registered CSS entries.");
  const entries = Object.entries(manifest.entryCSSFiles).filter(([key]) => routeEntries.has(routeEntry(key)));
  assert.ok(entries.some(([key]) => routeEntry(key) === `${route}/page`), "Treasury page CSS entry is missing.");
  const layoutEntry = entries.find(([key]) => routeEntry(key) === `${route}/layout`);
  assert.ok(layoutEntry, "Treasury layout CSS entry is missing; rebuild after adding the persistent route layout.");
  const layoutPaths = new Set(layoutEntry[1].map(asset => asset.path));
  const paths = [...new Set(entries.flatMap(([, assets]) => assets.map(asset => asset.path)))];
  assert.ok(paths.length, "Treasury route and its layouts register no CSS assets.");
  const diskAssets = await Promise.all(paths.map(async emittedPath => ({
    path: emittedPath,
    css: await fs.readFile(assetPath(buildRoot, emittedPath), "utf8"),
  })));
  const expectedClasses = inspectStyles(diskAssets, "Compiled assets");
  inspectStyles(diskAssets.filter(asset => layoutPaths.has(asset.path)), "Persistent layout assets", expectedClasses);
  console.log(`PASS Treasury ${mode}: ${paths.length} registered CSS assets, ${requiredRules.length} essential scoped rules owned by the persistent layout.`);

  if (baseUrl) {
    const servedAssets = await Promise.all(paths.map(async emittedPath => {
      const encodedPath = emittedPath.split("/").map(segment => encodeURIComponent(segment)).join("/");
      const response = await fetch(new URL(`/_next/${encodedPath}`, baseUrl), {
        redirect: "error", signal: AbortSignal.timeout(15000), cache: "no-store",
      });
      assert.equal(response.status, 200, `HTTP ${response.status} for ${emittedPath}`);
      assert.match(response.headers.get("content-type") ?? "", /^text\/css(?:\s*;|$)/i, `Wrong CSS MIME type for ${emittedPath}`);
      return { path: emittedPath, css: await response.text() };
    }));
    inspectStyles(servedAssets, "Served assets", expectedClasses);
    inspectStyles(servedAssets.filter(asset => layoutPaths.has(asset.path)), "Served layout assets", expectedClasses);
    console.log(`PASS Treasury HTTP: ${servedAssets.length} CSS responses have status 200, CSS MIME types, and matching scoped rules.`);
  }
}

main().catch(error => {
  console.error(`FAIL Treasury CSS: ${error.message}`);
  process.exitCode = 1;
});
