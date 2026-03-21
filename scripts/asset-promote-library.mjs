import fs from "node:fs";
import path from "node:path";
import { appendLibraryHistory } from "./library-history.mjs";

const ROOT = process.cwd();
const IMPORTED_LIBRARIES_DIR = path.join(ROOT, "libraries");
const IMPORTED_REGISTRY_PATH = path.join(IMPORTED_LIBRARIES_DIR, "libraries.json");
const BUILT_IN_REGISTRY_PATH = path.join(ROOT, "src", "data", "libraries.json");
const BUILT_IN_LIBRARY_DATA_DIR = path.join(ROOT, "src", "data", "libraries");
const BUILT_IN_ASSET_DIR = path.join(ROOT, "public", "assets", "libraries");
const BUILT_IN_THUMBNAIL_DIR = path.join(ROOT, "public", "generated", "asset-previews");

function printUsage() {
  console.log("Usage:");
  console.log('  npm run assets:promote-library -- "<library-id>"');
}

function assertExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function readJson(filePath, label) {
  assertExists(filePath, label);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function copyDirectory(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function main() {
  const libraryId = process.argv[2]?.trim();
  if (!libraryId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const importedLibraryDir = path.join(IMPORTED_LIBRARIES_DIR, libraryId);
  assertExists(importedLibraryDir, "Imported library");

  const importedMetaPath = path.join(importedLibraryDir, "library.json");
  const importedManifestPath = path.join(importedLibraryDir, "assets-manifest.json");
  const importedCategoriesPath = path.join(importedLibraryDir, "asset-categories.json");
  const importedTemplatesPath = path.join(importedLibraryDir, "asset-tag-templates.json");
  const importedGltfDir = path.join(importedLibraryDir, "glTF");
  const importedThumbnailsDir = path.join(importedLibraryDir, "thumbnails");

  const importedMeta = readJson(importedMetaPath, "Imported library metadata");
  if (importedMeta.version !== 1 || typeof importedMeta.id !== "string" || importedMeta.id !== libraryId) {
    throw new Error("Imported library metadata is invalid.");
  }

  const builtInRegistry = readJson(BUILT_IN_REGISTRY_PATH, "Built-in library registry");
  if (!builtInRegistry || builtInRegistry.version !== 1 || !Array.isArray(builtInRegistry.libraries)) {
    throw new Error("Built-in library registry is invalid.");
  }
  if (builtInRegistry.libraries.some((library) => library && library.id === libraryId)) {
    throw new Error(`Built-in library registry already contains ${libraryId}.`);
  }

  const builtInDataDir = path.join(BUILT_IN_LIBRARY_DATA_DIR, libraryId);
  const builtInMetaPath = path.join(builtInDataDir, "library.json");
  const builtInManifestPath = path.join(builtInDataDir, "assets-manifest.json");
  const builtInCategoriesPath = path.join(builtInDataDir, "asset-categories.json");
  const builtInTemplatesPath = path.join(builtInDataDir, "asset-tag-templates.json");
  const builtInLibraryAssetDir = path.join(BUILT_IN_ASSET_DIR, libraryId, "glTF");
  const builtInLibraryThumbnailDir = path.join(BUILT_IN_THUMBNAIL_DIR, libraryId);

  if (fs.existsSync(builtInDataDir)) {
    throw new Error(`Built-in library data directory already exists: ${builtInDataDir}`);
  }
  if (fs.existsSync(path.join(BUILT_IN_ASSET_DIR, libraryId))) {
    throw new Error(`Built-in library asset directory already exists: ${path.join(BUILT_IN_ASSET_DIR, libraryId)}`);
  }
  if (fs.existsSync(builtInLibraryThumbnailDir)) {
    throw new Error(`Built-in library thumbnail directory already exists: ${builtInLibraryThumbnailDir}`);
  }

  assertExists(importedManifestPath, "Imported library manifest");
  assertExists(importedCategoriesPath, "Imported categories");
  assertExists(importedTemplatesPath, "Imported tag templates");
  assertExists(importedGltfDir, "Imported glTF directory");
  assertExists(importedThumbnailsDir, "Imported thumbnails directory");

  const promotedMeta = {
    ...importedMeta,
    mode: "built-in",
    assetBasePath: `/assets/libraries/${libraryId}/glTF/`,
    thumbnailBasePath: `/generated/asset-previews/${libraryId}/`,
  };

  writeJson(builtInMetaPath, promotedMeta);
  fs.copyFileSync(importedManifestPath, builtInManifestPath);
  fs.copyFileSync(importedCategoriesPath, builtInCategoriesPath);
  fs.copyFileSync(importedTemplatesPath, builtInTemplatesPath);
  copyDirectory(importedGltfDir, builtInLibraryAssetDir);
  copyDirectory(importedThumbnailsDir, builtInLibraryThumbnailDir);

  builtInRegistry.libraries.push({
    id: libraryId,
    name: promotedMeta.name,
    mode: "built-in",
    metaPath: `./libraries/${libraryId}/library.json`,
  });
  builtInRegistry.libraries.sort((left, right) => String(left.name).localeCompare(String(right.name)));
  writeJson(BUILT_IN_REGISTRY_PATH, builtInRegistry);

  let importedRegistry = { version: 1, libraries: [] };
  if (fs.existsSync(IMPORTED_REGISTRY_PATH)) {
    importedRegistry = readJson(IMPORTED_REGISTRY_PATH, "Imported library registry");
    if (!importedRegistry || importedRegistry.version !== 1 || !Array.isArray(importedRegistry.libraries)) {
      throw new Error("Imported library registry is invalid.");
    }
  }

  const importedEntry = importedRegistry.libraries.find((library) => library && library.id === libraryId);
  if (importedEntry) {
    importedEntry.name = promotedMeta.name;
    importedEntry.mode = "built-in";
    importedEntry.metaPath = `./${libraryId}/library.json`;
    writeJson(IMPORTED_REGISTRY_PATH, importedRegistry);
  }

  writeJson(importedMetaPath, promotedMeta);

  appendLibraryHistory({
    action: "promote",
    libraryId,
    message: "Promoted library into built-in source folders.",
    details: {
      builtInDataDir,
      builtInLibraryAssetDir,
      builtInLibraryThumbnailDir,
    },
  });

  console.log(`Promoted library copied into built-in source folders: ${libraryId}`);
  console.log(`- Metadata: ${builtInDataDir}`);
  console.log(`- Assets: ${builtInLibraryAssetDir}`);
  console.log(`- Thumbnails: ${builtInLibraryThumbnailDir}`);
  console.log("Next steps:");
  console.log("- Commit the new built-in files if you want them included with the app.");
  console.log("- Reload the app and studio pages.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
