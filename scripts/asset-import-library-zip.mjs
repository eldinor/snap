import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { appendLibraryHistory } from "./library-history.mjs";

const ROOT = process.cwd();
const LIBRARIES_DIR = path.join(ROOT, "libraries");
const IMPORTED_REGISTRY_PATH = path.join(LIBRARIES_DIR, "libraries.json");

function printUsage() {
  console.log("Usage:");
  console.log('  npm run assets:import-library-zip -- "<asset-pack.zip>" "<draft-library.zip>"');
}

function isValidDraftReport(report) {
  return (
    report &&
    typeof report === "object" &&
    typeof report.gltfPath === "string" &&
    Array.isArray(report.referencedFiles) &&
    Array.isArray(report.missingFiles) &&
    Array.isArray(report.externalUris) &&
    Array.isArray(report.collidingFiles) &&
    !report.parseError &&
    report.missingFiles.length === 0 &&
    report.externalUris.length === 0 &&
    report.collidingFiles.length === 0
  );
}

function assertObject(value, name) {
  if (!value || typeof value !== "object") {
    throw new Error(`${name} is invalid.`);
  }
}

function normalizeZipPath(value) {
  const slashNormalized = value.replace(/\\/g, "/");
  const parts = slashNormalized.split("/");
  const normalizedParts = [];

  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      normalizedParts.pop();
      continue;
    }
    normalizedParts.push(part);
  }

  return normalizedParts.join("/");
}

async function loadZip(zipPath) {
  const fileBuffer = fs.readFileSync(zipPath);
  return JSZip.loadAsync(fileBuffer);
}

async function readJson(zip, fileName) {
  const entry = zip.file(fileName);
  if (!entry) {
    throw new Error(`Draft ZIP is missing ${fileName}.`);
  }
  return JSON.parse(await entry.async("string"));
}

function ensureArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array.`);
  }
}

function loadImportedRegistry() {
  if (!fs.existsSync(IMPORTED_REGISTRY_PATH)) {
    return { version: 1, libraries: [] };
  }

  const manifest = JSON.parse(fs.readFileSync(IMPORTED_REGISTRY_PATH, "utf8"));
  if (!manifest || typeof manifest !== "object" || manifest.version !== 1 || !Array.isArray(manifest.libraries)) {
    throw new Error("Imported library registry is invalid.");
  }

  return manifest;
}

function writeImportedRegistry(manifest) {
  fs.mkdirSync(path.dirname(IMPORTED_REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(IMPORTED_REGISTRY_PATH, JSON.stringify(manifest, null, 2) + "\n");
}

function validateDraftPayload(libraryMeta, manifest, categories, tagTemplates, inspection) {
  assertObject(libraryMeta, "library.json");
  assertObject(manifest, "assets-manifest.json");
  assertObject(categories, "asset-categories.json");
  assertObject(tagTemplates, "asset-tag-templates.json");
  assertObject(inspection, "inspection-report.json");

  if (libraryMeta.version !== 1 || typeof libraryMeta.id !== "string" || !libraryMeta.id.trim()) {
    throw new Error("Draft library metadata must include version 1 and a non-empty id.");
  }
  if (libraryMeta.mode !== "imported") {
    throw new Error("Draft library metadata must use mode \"imported\".");
  }
  if (manifest.version !== 1 || !Array.isArray(manifest.assets) || manifest.assets.length === 0) {
    throw new Error("Draft asset manifest must include at least one asset.");
  }
  if (categories.version !== 1 || !Array.isArray(categories.categories) || categories.categories.length === 0) {
    throw new Error("Draft category manifest must include at least one category.");
  }
  if (tagTemplates.version !== 1 || !tagTemplates.categories || typeof tagTemplates.categories !== "object") {
    throw new Error("Draft tag template manifest is invalid.");
  }
  if (typeof inspection.zipFileName !== "string" || !Array.isArray(inspection.reports)) {
    throw new Error("Draft inspection report is invalid.");
  }
}

async function main() {
  const assetZipPath = process.argv[2];
  const draftZipPath = process.argv[3];

  if (!assetZipPath || !draftZipPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(assetZipPath)) {
    throw new Error(`Asset ZIP not found: ${assetZipPath}`);
  }
  if (!fs.existsSync(draftZipPath)) {
    throw new Error(`Draft ZIP not found: ${draftZipPath}`);
  }

  const [assetZip, draftZip] = await Promise.all([loadZip(assetZipPath), loadZip(draftZipPath)]);
  const [libraryMeta, manifest, categories, tagTemplates, inspection] = await Promise.all([
    readJson(draftZip, "library.json"),
    readJson(draftZip, "assets-manifest.json"),
    readJson(draftZip, "asset-categories.json"),
    readJson(draftZip, "asset-tag-templates.json"),
    readJson(draftZip, "inspection-report.json"),
  ]);

  validateDraftPayload(libraryMeta, manifest, categories, tagTemplates, inspection);

  const libraryId = libraryMeta.id.trim();
  const targetDir = path.join(LIBRARIES_DIR, libraryId);
  if (fs.existsSync(targetDir)) {
    throw new Error(`Target library already exists: ${targetDir}`);
  }

  const importedRegistry = loadImportedRegistry();
  if (importedRegistry.libraries.some((library) => library && library.id === libraryId)) {
    throw new Error(`Imported library registry already contains ${libraryId}.`);
  }

  const validReports = inspection.reports.filter(isValidDraftReport);
  const validReportMap = new Map(validReports.map((report) => [normalizeZipPath(report.gltfPath), report]));
  const manifestFileNames = manifest.assets.map((asset) => normalizeZipPath(asset.fileName));
  ensureArray(manifest.assets, "assets-manifest.json assets");

  manifestFileNames.forEach((fileName) => {
    if (!validReportMap.has(fileName)) {
      throw new Error(`Draft manifest asset file is not present in the valid inspection set: ${fileName}`);
    }
  });

  const filesToExtract = new Set();
  manifestFileNames.forEach((fileName) => {
    const report = validReportMap.get(fileName);
    if (!report) return;
    filesToExtract.add(normalizeZipPath(report.gltfPath));
    report.referencedFiles.forEach((entry) => {
      filesToExtract.add(normalizeZipPath(entry));
    });
  });

  const assetZipFiles = new Set(
    Object.values(assetZip.files)
      .filter((entry) => !entry.dir)
      .map((entry) => normalizeZipPath(entry.name)),
  );

  for (const filePath of filesToExtract) {
    if (!assetZipFiles.has(filePath)) {
      throw new Error(`Asset ZIP is missing required file: ${filePath}`);
    }
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.mkdirSync(path.join(targetDir, "glTF"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "thumbnails"), { recursive: true });

  fs.writeFileSync(path.join(targetDir, "library.json"), JSON.stringify(libraryMeta, null, 2) + "\n");
  fs.writeFileSync(path.join(targetDir, "assets-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  fs.writeFileSync(path.join(targetDir, "asset-categories.json"), JSON.stringify(categories, null, 2) + "\n");
  fs.writeFileSync(path.join(targetDir, "asset-tag-templates.json"), JSON.stringify(tagTemplates, null, 2) + "\n");
  fs.writeFileSync(path.join(targetDir, "inspection-report.json"), JSON.stringify(inspection, null, 2) + "\n");
  fs.writeFileSync(path.join(targetDir, "thumbnails", ".gitkeep"), "");

  for (const zipPath of filesToExtract) {
    const entry = assetZip.file(zipPath);
    if (!entry) {
      throw new Error(`Could not read ${zipPath} from the asset ZIP.`);
    }
    const outputPath = path.join(targetDir, "glTF", ...zipPath.split("/"));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const buffer = await entry.async("nodebuffer");
    fs.writeFileSync(outputPath, buffer);
  }

  importedRegistry.libraries.push({
    id: libraryId,
    name: libraryMeta.name,
    mode: "imported",
    metaPath: `./${libraryId}/library.json`,
  });
  importedRegistry.libraries.sort((left, right) => String(left.name).localeCompare(String(right.name)));
  writeImportedRegistry(importedRegistry);

  appendLibraryHistory({
    action: "import",
    libraryId,
    message: `Imported library with ${manifest.assets.length} assets.`,
    details: {
      assetsWritten: manifest.assets.length,
      filesExtracted: filesToExtract.size,
    },
  });

  console.log(`Imported library created at ${targetDir}`);
  console.log(`Assets written: ${manifest.assets.length}`);
  console.log(`Files extracted: ${filesToExtract.size}`);
  console.log(`Imported registry updated: ${IMPORTED_REGISTRY_PATH}`);
  console.log("Next steps:");
  console.log(`- Add thumbnails under ${path.join(targetDir, "thumbnails")}`);
  console.log("- Reload the app to let the library selector discover the imported library.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
