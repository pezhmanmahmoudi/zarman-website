import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { createHash } from "node:crypto";

const sourceDirectory = path.join(process.cwd(), "public", "animations", "dashboard");
const outputDirectory = path.join(sourceDirectory, "preview");
// Optional exact filenames refresh only the supplied assets, with cache-safe URLs.
const requestedNames = process.argv.slice(2);

function previewSlug(fileName) {
  return path
    .basename(fileName, ".lottie")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function extractArchive(fileName) {
  const archive = await JSZip.loadAsync(fs.readFileSync(path.join(sourceDirectory, fileName)));
  const manifestFile = archive.file("manifest.json");
  if (!manifestFile) throw new Error(`${fileName}: manifest.json is missing`);

  const manifest = JSON.parse(await manifestFile.async("string"));
  const animationId = manifest.animations?.[0]?.id;
  const animationFile = animationId ? archive.file(`animations/${animationId}.json`) : null;
  if (!animationFile) throw new Error(`${fileName}: animation JSON is missing`);

  const animationJson = await animationFile.async("string");
  JSON.parse(animationJson);

  const slug = previewSlug(fileName);
  const revision = requestedNames.length ? `-${createHash("sha256").update(animationJson).digest("hex").slice(0, 12)}` : "";
  const outputName = `${slug}${revision}.json`;
  fs.writeFileSync(path.join(outputDirectory, outputName), animationJson);

  return {
    name: path.basename(fileName, ".lottie"),
    source: fileName,
    src: `/animations/dashboard/preview/${outputName}`,
  };
}

async function main() {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const archiveNames = fs
    .readdirSync(sourceDirectory)
    .filter((fileName) => fileName.toLowerCase().endsWith(".lottie"))
    .sort((left, right) => left.localeCompare(right, "en"));

  for (const name of requestedNames) {
    if (!archiveNames.includes(name)) throw new Error(`Unknown dashboard Lottie: ${name}`);
  }
  const selectedNames = requestedNames.length ? archiveNames.filter(name => requestedNames.includes(name)) : archiveNames;
  const indexPath = path.join(outputDirectory, "index.json");
  const animations = requestedNames.length && fs.existsSync(indexPath)
    ? JSON.parse(fs.readFileSync(indexPath, "utf8")).animations.filter(item => !selectedNames.includes(item.source))
    : [];
  for (const fileName of selectedNames) animations.push(await extractArchive(fileName));
  animations.sort((left, right) => left.source.localeCompare(right.source, "en"));

  fs.writeFileSync(
    path.join(outputDirectory, "index.json"),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), animations }, null, 2)}\n`,
  );
  console.log(`Extracted ${selectedNames.length} dashboard Lottie previews.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
