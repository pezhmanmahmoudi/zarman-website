/* eslint-disable @typescript-eslint/no-require-imports -- This standalone Node generator uses CommonJS like the repository test tools. */
/**
 * Original Zarman motion icon artwork. SVG posters and Lottie animations share
 * the same path model so the no-motion and animated experiences match exactly.
 * Run with --check to validate committed assets without writing to the tree.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const output = path.resolve(__dirname, "../public/animations/dashboard");
const palette = {
  ink: "#20242c",
  violet: "#635bff",
  violetWash: "#f0efff",
  green: "#16836b",
  greenWash: "#e9f6f1",
  amber: "#b57416",
  amberWash: "#fff4df",
  paper: "#ffffff",
};
const frames = 48;
const round = (value) => Math.round(value * 10000) / 10000;
const property = (value) => ({ a: 0, k: value });
const tween = (start, end, from = 0, to = 100) => ({
  a: 1,
  k: [
    { t: start, s: [from], e: [to], o: { x: [0.2], y: [0] }, i: { x: [0.2], y: [1] } },
    { t: end, s: [to] },
  ],
});

/** The single model supports the cubic paths required by both output formats. */
function vector(commands, closed = false) {
  const vertices = [];
  const incoming = [];
  const outgoing = [];
  for (const command of commands) {
    if (command[0] === "M" || command[0] === "L") {
      vertices.push(command.slice(1));
      incoming.push([0, 0]);
      outgoing.push([0, 0]);
    } else if (command[0] === "C") {
      const previous = vertices.at(-1);
      outgoing[outgoing.length - 1] = [command[1] - previous[0], command[2] - previous[1]].map(round);
      vertices.push([command[5], command[6]]);
      incoming.push([command[3] - command[5], command[4] - command[6]].map(round));
      outgoing.push([0, 0]);
    } else {
      throw new Error(`Unsupported path command ${command[0]}`);
    }
  }
  // A closed path must not repeat its first vertex in Lottie's cubic model.
  if (closed && vertices.length > 1 && vertices[0].every((value, axis) => value === vertices.at(-1)[axis])) {
    incoming[0] = incoming.pop();
    vertices.pop();
    outgoing.pop();
  }
  return {
    lottie: { i: incoming, o: outgoing, v: vertices, c: closed },
    svg: commands.map((command) => command.join(" ")).join(" ") + (closed ? " Z" : ""),
  };
}

function line(points) {
  return vector(points.map((point, index) => [index ? "L" : "M", ...point]));
}

function circle(cx, cy, radius) {
  const handle = round(radius * 0.5522847498);
  return vector([
    ["M", cx, cy - radius],
    ["C", cx + handle, cy - radius, cx + radius, cy - handle, cx + radius, cy],
    ["C", cx + radius, cy + handle, cx + handle, cy + radius, cx, cy + radius],
    ["C", cx - handle, cy + radius, cx - radius, cy + handle, cx - radius, cy],
    ["C", cx - radius, cy - handle, cx - handle, cy - radius, cx, cy - radius],
  ], true);
}

function roundedRect(x, y, width, height, radius) {
  const handle = round(radius * 0.5522847498);
  return vector([
    ["M", x + radius, y],
    ["L", x + width - radius, y],
    ["C", x + width - radius + handle, y, x + width, y + radius - handle, x + width, y + radius],
    ["L", x + width, y + height - radius],
    ["C", x + width, y + height - radius + handle, x + width - radius + handle, y + height, x + width - radius, y + height],
    ["L", x + radius, y + height],
    ["C", x + radius - handle, y + height, x, y + height - radius + handle, x, y + height - radius],
    ["L", x, y + radius],
    ["C", x, y + radius - handle, x + radius - handle, y, x + radius, y],
  ], true);
}

const outline = (name, shape, color = palette.ink, start = 4, width = 2) => ({ name, shape, stroke: color, start, width });
const fill = (name, shape, color, start = 0) => ({ name, shape, fill: color, start });
const wash = (color = palette.violetWash) => fill("Soft colour field", circle(32, 32, 25), color);
const paper = (name, shape, start = 2) => fill(name, shape, palette.paper, start);

const documentShape = roundedRect(17, 13, 28, 37, 5);
const identityShape = roundedRect(11, 18, 42, 30, 6);
const receiptShape = vector([
  ["M", 21, 12], ["L", 38, 12], ["C", 41.3, 12, 44, 14.7, 44, 18],
  ["L", 44, 48], ["L", 38, 45], ["L", 32, 49], ["L", 26, 45], ["L", 20, 49],
  ["L", 20, 18], ["C", 20, 14.7, 20, 12, 21, 12],
], true);

const icons = {
  review: [
    wash(), paper("Review document paper", documentShape),
    outline("Review document", documentShape),
    outline("Document first line", line([[24, 23], [35, 23]]), palette.ink, 8),
    outline("Document second line", line([[24, 29], [32, 29]]), palette.ink, 10),
    paper("Pending clock paper", circle(44, 43, 11), 10),
    outline("Pending clock", circle(44, 43, 11), palette.violet, 12, 2.3),
    outline("Clock hands", line([[44, 37], [44, 43], [48, 45]]), palette.violet, 21, 2.3),
  ],
  verify: [
    wash(), paper("Identity card paper", identityShape),
    outline("Identity card", identityShape),
    outline("Person silhouette head", circle(25, 29, 4), palette.violet, 10, 2.3),
    outline("Person silhouette shoulders", vector([["M", 18, 40], ["C", 18, 33, 32, 33, 32, 40]]), palette.violet, 17, 2.3),
    outline("Identity first line", line([[38, 28], [46, 28]]), palette.ink, 17),
    outline("Identity second line", line([[38, 34], [43, 34]]), palette.ink, 20),
  ],
  upload: [
    wash(), paper("Payment receipt paper", receiptShape),
    outline("Payment receipt", receiptShape),
    outline("Receipt first line", line([[26, 22], [36, 22]]), palette.ink, 8),
    outline("Receipt second line", line([[26, 28], [32, 28]]), palette.ink, 11),
    paper("Upload action paper", circle(45, 42, 11), 10),
    outline("Upload action ring", circle(45, 42, 11), palette.violet, 12, 2.3),
    outline("Upload shaft", line([[45, 47], [45, 37]]), palette.violet, 20, 2.3),
    outline("Upload direction", line([[40, 42], [45, 37], [50, 42]]), palette.violet, 24, 2.3),
  ],
  received: [
    wash(palette.greenWash),
    paper("Bank facade paper", roundedRect(13, 25, 38, 25, 2)),
    outline("Bank pediment", vector([["M", 12, 25], ["L", 32, 14], ["L", 52, 25]], false)),
    outline("Bank lintel", line([[15, 27], [49, 27]]), palette.ink, 7),
    outline("Left bank pillar", line([[21, 32], [21, 43]]), palette.ink, 10),
    outline("Centre bank pillar", line([[31, 32], [31, 43]]), palette.ink, 12),
    outline("Bank foundation", line([[13, 49], [38, 49]]), palette.ink, 14),
    paper("Funds acknowledgement paper", circle(46, 44, 10), 14),
    outline("Funds acknowledgement ring", circle(46, 44, 10), palette.green, 17, 2.3),
    outline("Funds acknowledged", line([[41.5, 44], [44.5, 47], [50.5, 40.5]]), palette.green, 24, 2.5),
  ],
  complete: [
    wash(palette.greenWash),
    paper("Completion seal paper", circle(32, 32, 19)),
    outline("Completion seal", circle(32, 32, 19), palette.green, 4, 2.3),
    outline("Completed transfer", line([[23, 32], [29, 38], [42, 25]]), palette.green, 16, 3),
  ],
  recipients: [
    wash(),
    outline("Additional recipient head", circle(43, 24, 6), palette.violet, 5, 2.3),
    outline("Additional recipient shoulders", vector([["M", 41, 36], ["C", 50, 33, 55, 37, 55, 45]]), palette.violet, 13, 2.3),
    paper("Primary recipient head paper", circle(27, 25, 8)),
    paper("Primary recipient shoulders paper", vector([["M", 12, 48], ["C", 12, 32, 42, 32, 42, 48], ["L", 12, 48]], true)),
    outline("Primary recipient head", circle(27, 25, 8), palette.ink, 10, 2.3),
    outline("Primary recipient shoulders", vector([["M", 12, 48], ["C", 12, 32, 42, 32, 42, 48]]), palette.ink, 20, 2.3),
  ],
  attention: [
    wash(palette.amberWash),
    paper("Action required paper", circle(32, 32, 19)),
    outline("Action required ring", circle(32, 32, 19), palette.amber, 4, 2.3),
    outline("Attention stem", line([[32, 22], [32, 33]]), palette.amber, 17, 2.8),
    fill("Attention point", circle(32, 41, 1.7), palette.amber, 27),
  ],
};

function rgba(hex) {
  return [...hex.matchAll(/[0-9a-f]{2}/gi)].map((part) => round(parseInt(part[0], 16) / 255)).concat(1);
}

function layer(element, index) {
  const shapes = [{ ty: "sh", nm: element.name, ks: property(element.shape.lottie) }];
  if (element.fill) {
    shapes.push({ ty: "fl", c: property(rgba(element.fill)), o: property(100), r: 1 });
  }
  if (element.stroke) {
    shapes.push({ ty: "st", c: property(rgba(element.stroke)), o: property(100), w: property(element.width), lc: 2, lj: 2, ml: 4 });
    shapes.push({ ty: "tm", s: property(0), e: tween(element.start, Math.min(element.start + 17, 43)), o: property(0), m: 1 });
  }
  return {
    ddd: 0, ind: index + 1, ty: 4, nm: element.name, sr: 1,
    ks: {
      o: element.fill ? tween(element.start, element.start + 9) : property(100),
      r: property(0), p: property([0, 0, 0]), a: property([0, 0, 0]), s: property([100, 100, 100]),
    },
    ao: 0, shapes, ip: 0, op: frames, st: 0, bm: 0,
  };
}

function animation(name, elements) {
  return {
    v: "5.12.2", fr: 30, ip: 0, op: frames, w: 64, h: 64,
    nm: `Zarman ${name}`, ddd: 0, assets: [],
    layers: elements.map(layer).reverse(),
    markers: [{ tm: 44, cm: "Resting state", dr: 4 }],
  };
}

function poster(elements) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">${elements.map((element) => `<path d="${element.shape.svg}" fill="${element.fill || "none"}"${element.stroke ? ` stroke="${element.stroke}" stroke-width="${element.width}" stroke-linecap="round" stroke-linejoin="round"` : ""}/>`).join("")}</svg>\n`;
}

function verify(name, data, svg, elements) {
  assert.equal(data.w, 64);
  assert.equal(data.h, 64);
  assert.equal(data.op / data.fr, 1.6);
  assert.deepEqual(data.assets, []);
  assert.equal(data.layers.length, elements.length);
  assert.ok(Buffer.byteLength(JSON.stringify(data)) < 15 * 1024, `${name}: animation exceeds byte budget`);
  assert.ok(!/https?:|data:|<script|<animate|<image|<text/.test(svg.replace('xmlns="http://www.w3.org/2000/svg"', "")), `${name}: poster must remain local and static`);
  for (const current of data.layers) {
    assert.equal(current.ty, 4, `${name}: only vector shape layers are permitted`);
    assert.equal(current.op, frames);
    const geometry = current.shapes[0].ks.k;
    assert.equal(geometry.v.length, geometry.i.length);
    assert.equal(geometry.v.length, geometry.o.length);
    assert.ok(geometry.v.every((point) => point.every((value) => Number.isFinite(value) && value >= 2 && value <= 62)), `${name}: vector escapes the viewport`);
    for (const shape of current.shapes) {
      assert.ok(["sh", "fl", "st", "tm"].includes(shape.ty), `${name}: unsupported vector operator`);
      if (shape.ty === "tm") {
        assert.equal(shape.e.k.at(-1).s[0], 100, `${name}: final frame must contain the complete stroke`);
        assert.ok(shape.e.k.at(-1).t < 44, `${name}: must settle before resting state`);
      }
    }
  }
}

const check = process.argv.includes("--check");
if (!check) fs.mkdirSync(output, { recursive: true });
for (const [name, elements] of Object.entries(icons)) {
  const data = animation(name, elements);
  const svg = poster(elements);
  verify(name, data, svg, elements);
  for (const [extension, content] of [["json", JSON.stringify(data) + "\n"], ["svg", svg]]) {
    const destination = path.join(output, `${name}.${extension}`);
    if (check) assert.equal(fs.readFileSync(destination, "utf8"), content, `${name}.${extension} differs from its original vector source`);
    else fs.writeFileSync(destination, content, "utf8");
  }
  process.stdout.write(`${check ? "Verified" : "Generated"} ${name}: ${Buffer.byteLength(JSON.stringify(data))} B JSON, ${Buffer.byteLength(svg)} B SVG\n`);
}
