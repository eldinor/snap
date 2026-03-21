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
  console.log('  npm run assets:remove-library -- "<library-id>" --delete-files');
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function removeDirectoryIfExists(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function main() {
  const libraryId = process.argv[2]?.trim();
  const deleteFiles = process.argv.includes("--delete-files");

  if (!libraryId || !deleteFiles) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const builtInRegistry = readJsonIfExists(BUILT_IN_REGISTRY_PATH);
  const importedRegistry = readJsonIfExists(IMPORTED_REGISTRY_PATH);

  const builtInEntry = builtInRegistry?.libraries?.find((library) => library && library.id === libraryId) ?? null;
  const importedEntry = importedRegistry?.libraries?.find((library) => library && library.id === libraryId) ?? null;

  if (!builtInEntry && !importedEntry) {
    throw new Error(`Library ${libraryId} was not found in built-in or imported registries.`);
  }

  if (builtInEntry && libraryId === "built-in") {
    throw new Error('The core "built-in" library cannot be removed with this script.');
  }

  if (builtInEntry && builtInRegistry) {
    builtInRegistry.libraries = builtInRegistry.libraries.filter((library) => library?.id !== libraryId);
    writeJson(BUILT_IN_REGISTRY_PATH, builtInRegistry);

    removeDirectoryIfExists(path.join(BUILT_IN_LIBRARY_DATA_DIR, libraryId));
    removeDirectoryIfExists(path.join(BUILT_IN_ASSET_DIR, libraryId));
    removeDirectoryIfExists(path.join(BUILT_IN_THUMBNAIL_DIR, libraryId));
  }

  if (importedEntry && importedRegistry) {
    importedRegistry.libraries = importedRegistry.libraries.filter((library) => library?.id !== libraryId);
    writeJson(IMPORTED_REGISTRY_PATH, importedRegistry);

    removeDirectoryIfExists(path.join(IMPORTED_LIBRARIES_DIR, libraryId));
  }

  appendLibraryHistory({
    action: "remove",
    libraryId,
    message: "Removed library and registry entries.",
    details: {
      removedBuiltIn: !!builtInEntry,
      removedImported: !!importedEntry,
    },
  });

  console.log(`Removed library: ${libraryId}`);
  if (builtInEntry) {
    console.log("- Removed built-in registry entry and built-in library files.");
  }
  if (importedEntry) {
    console.log("- Removed imported registry entry and imported library files.");
  }
  console.log("Next steps:");
  console.log("- Reload the app and studio pages.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
