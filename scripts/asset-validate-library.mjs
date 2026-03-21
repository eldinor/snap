import fs from "node:fs";
import path from "node:path";
import { appendLibraryHistory } from "./library-history.mjs";

const ROOT = process.cwd();
const BUILT_IN_REGISTRY_PATH = path.join(ROOT, "src", "data", "libraries.json");
const IMPORTED_REGISTRY_PATH = path.join(ROOT, "libraries", "libraries.json");
const REPORT_DIR = path.join(ROOT, "public", "generated", "library-validation");

function printUsage() {
  console.log("Usage:");
  console.log('  npm run assets:validate-library -- "<library-id>"');
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function resolveRepoPathFromMeta(metaFilePath, relativeOrAbsolutePath) {
  if (relativeOrAbsolutePath.startsWith("/assets/")) {
    return path.join(ROOT, "public", relativeOrAbsolutePath.slice(1));
  }
  if (relativeOrAbsolutePath.startsWith("/generated/")) {
    return path.join(ROOT, "public", relativeOrAbsolutePath.slice(1));
  }
  return path.resolve(path.dirname(metaFilePath), relativeOrAbsolutePath);
}

function isExternalUri(uri) {
  return typeof uri === "string" && !uri.startsWith("data:") && !/^[a-z]+:/iu.test(uri);
}

function validateGltfSidecars(assetFilePath) {
  const errors = [];
  const warnings = [];

  try {
    const gltf = JSON.parse(fs.readFileSync(assetFilePath, "utf8"));
    const buffers = Array.isArray(gltf.buffers) ? gltf.buffers : [];
    const images = Array.isArray(gltf.images) ? gltf.images : [];

    buffers.forEach((buffer, index) => {
      if (!buffer || typeof buffer !== "object") {
        warnings.push(`${path.basename(assetFilePath)}: buffers[${index}] is invalid.`);
        return;
      }
      if (!isExternalUri(buffer.uri)) {
        return;
      }
      const bufferPath = path.resolve(path.dirname(assetFilePath), buffer.uri);
      if (!fs.existsSync(bufferPath)) {
        errors.push(`${path.basename(assetFilePath)}: missing buffer sidecar ${buffer.uri}`);
      }
    });

    images.forEach((image, index) => {
      if (!image || typeof image !== "object") {
        warnings.push(`${path.basename(assetFilePath)}: images[${index}] is invalid.`);
        return;
      }
      if (!isExternalUri(image.uri)) {
        return;
      }
      const imagePath = path.resolve(path.dirname(assetFilePath), image.uri);
      if (!fs.existsSync(imagePath)) {
        errors.push(`${path.basename(assetFilePath)}: missing texture sidecar ${image.uri}`);
      }
    });
  } catch (error) {
    errors.push(
      `${path.basename(assetFilePath)}: could not parse glTF JSON (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  return { errors, warnings };
}

function validateManifest(manifest, categories, assetDir, thumbnailDir) {
  const errors = [];
  const warnings = [];

  if (!manifest || typeof manifest !== "object" || manifest.version !== 1 || !Array.isArray(manifest.assets)) {
    errors.push("Manifest must contain version 1 and an assets array.");
    return { errors, warnings };
  }

  if (!Array.isArray(categories) || categories.length === 0) {
    errors.push("Category manifest must contain at least one category.");
    return { errors, warnings };
  }

  const ids = new Set();
  const fileNames = new Set();
  const thumbnailFileNames = new Set();
  const categorySet = new Set(categories);

  manifest.assets.forEach((asset, index) => {
    const prefix = `assets[${index}]`;
    if (!asset || typeof asset !== "object") {
      errors.push(`${prefix} must be an object.`);
      return;
    }

    if (typeof asset.id !== "string" || !asset.id) errors.push(`${prefix}.id must be a non-empty string.`);
    if (typeof asset.name !== "string" || !asset.name) errors.push(`${prefix}.name must be a non-empty string.`);
    if (!categorySet.has(asset.category)) errors.push(`${prefix}.category is invalid.`);
    if (typeof asset.fileName !== "string" || !asset.fileName.endsWith(".gltf")) errors.push(`${prefix}.fileName must be a .gltf file.`);
    if (typeof asset.thumbnailFileName !== "string" || !asset.thumbnailFileName.endsWith(".png")) errors.push(`${prefix}.thumbnailFileName must be a .png file.`);
    if (!Array.isArray(asset.tags) || asset.tags.some((tag) => typeof tag !== "string")) errors.push(`${prefix}.tags must be a string array.`);

    if (
      !asset.placeholder ||
      typeof asset.placeholder !== "object" ||
      !["box", "column"].includes(asset.placeholder.shape) ||
      !Array.isArray(asset.placeholder.size) ||
      asset.placeholder.size.length !== 3 ||
      asset.placeholder.size.some((component) => typeof component !== "number") ||
      typeof asset.placeholder.color !== "string"
    ) {
      errors.push(`${prefix}.placeholder is invalid.`);
    }

    if (typeof asset.id === "string") {
      if (ids.has(asset.id)) errors.push(`Duplicate asset id: ${asset.id}`);
      ids.add(asset.id);
    }

    if (typeof asset.fileName === "string") {
      if (fileNames.has(asset.fileName)) errors.push(`Duplicate asset fileName: ${asset.fileName}`);
      fileNames.add(asset.fileName);

      const assetPath = path.join(assetDir, ...asset.fileName.split("/"));
      if (!fs.existsSync(assetPath)) {
        errors.push(`Missing asset file: ${asset.fileName}`);
      } else {
        const sidecarResults = validateGltfSidecars(assetPath);
        errors.push(...sidecarResults.errors);
        warnings.push(...sidecarResults.warnings);
      }
    }

    if (typeof asset.thumbnailFileName === "string") {
      if (thumbnailFileNames.has(asset.thumbnailFileName)) errors.push(`Duplicate thumbnailFileName: ${asset.thumbnailFileName}`);
      thumbnailFileNames.add(asset.thumbnailFileName);

      const thumbnailPath = path.join(thumbnailDir, asset.thumbnailFileName);
      if (!fs.existsSync(thumbnailPath)) {
        warnings.push(`Missing thumbnail: ${asset.thumbnailFileName}`);
      }
    }
  });

  return { errors, warnings };
}

function loadRegistry(filePath) {
  if (!fs.existsSync(filePath)) {
    return { version: 1, libraries: [] };
  }
  const manifest = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!manifest || typeof manifest !== "object" || manifest.version !== 1 || !Array.isArray(manifest.libraries)) {
    throw new Error(`Invalid library registry: ${filePath}`);
  }
  return manifest;
}

function resolveLibraryLocation(libraryId) {
  const builtInRegistry = loadRegistry(BUILT_IN_REGISTRY_PATH);
  const importedRegistry = loadRegistry(IMPORTED_REGISTRY_PATH);

  const builtInEntry = builtInRegistry.libraries.find((library) => library?.id === libraryId) ?? null;
  const importedEntry = importedRegistry.libraries.find((library) => library?.id === libraryId) ?? null;

  if (builtInEntry) {
    const metaFilePath = path.join(ROOT, "src", "data", builtInEntry.metaPath.replace(/^\.\//, ""));
    return { mode: "built-in", metaFilePath };
  }

  if (importedEntry) {
    const metaFilePath = path.join(ROOT, "libraries", importedEntry.metaPath.replace(/^\.\//, ""));
    return { mode: importedEntry.mode ?? "imported", metaFilePath };
  }

  throw new Error(`Library ${libraryId} was not found in built-in or imported registries.`);
}

function main() {
  const libraryId = process.argv[2]?.trim();
  if (!libraryId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const { mode, metaFilePath } = resolveLibraryLocation(libraryId);
  const meta = readJson(metaFilePath, "Library metadata");
  const manifest = readJson(resolveRepoPathFromMeta(metaFilePath, meta.assetManifest), "Asset manifest");
  const categoryManifest = readJson(resolveRepoPathFromMeta(metaFilePath, meta.categories), "Category manifest");
  const assetDir = resolveRepoPathFromMeta(metaFilePath, meta.assetBasePath);
  const thumbnailDir = resolveRepoPathFromMeta(metaFilePath, meta.thumbnailBasePath);

  const results = validateManifest(manifest, categoryManifest.categories, assetDir, thumbnailDir);
  const report = {
    generatedAt: new Date().toISOString(),
    libraryId,
    mode,
    errors: results.errors,
    warnings: results.warnings,
  };

  writeJson(path.join(REPORT_DIR, `${libraryId}.json`), report);

  appendLibraryHistory({
    action: "validate",
    libraryId,
    message: `Validated library with ${results.errors.length} error(s) and ${results.warnings.length} warning(s).`,
    details: {
      errors: results.errors.length,
      warnings: results.warnings.length,
    },
  });

  if (results.errors.length === 0 && results.warnings.length === 0) {
    console.log(`Library ${libraryId} is valid.`);
  } else {
    if (results.errors.length > 0) {
      console.error("Errors:");
      results.errors.forEach((entry) => console.error(`- ${entry}`));
    }
    if (results.warnings.length > 0) {
      console.warn("Warnings:");
      results.warnings.forEach((entry) => console.warn(`- ${entry}`));
    }
  }

  console.log(`Validation report written to ${path.relative(ROOT, path.join(REPORT_DIR, `${libraryId}.json`))}.`);
  process.exit(results.errors.length > 0 ? 1 : 0);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
