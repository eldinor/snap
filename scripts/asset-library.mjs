import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "src", "data", "assets-manifest.json");
const ASSET_DIR = path.join(ROOT, "public", "assets", "glTF");
const THUMBNAIL_DIR = path.join(ROOT, "public", "generated", "asset-previews");
const SCREENSHOT_MANIFEST_PATH = path.join(ROOT, "public", "generated", "asset-screenshot-manifest.json");

const ASSET_CATEGORIES = [
  "Floors",
  "Walls",
  "Corners",
  "Doors",
  "Windows",
  "Roofs",
  "Stairs",
  "Props",
  "Balconies",
  "Decorations",
];

const CATEGORY_ORDER = new Map(ASSET_CATEGORIES.map((category, index) => [category, index]));
const TOKEN_SPLIT_PATTERN = /(?=[A-Z][a-z])|_|(?<=\d)(?=[A-Za-z])|(?<=[A-Za-z])(?=\d)/g;

function detectCategory(file) {
  if (file.startsWith("Floor_") || file.startsWith("HoleCover_")) return "Floors";
  if (file.startsWith("Wall_")) return "Walls";
  if (file.startsWith("Corner_")) return "Corners";
  if (file.startsWith("Door") || file.startsWith("DoorFrame_")) return "Doors";
  if (file.startsWith("Window") || file.startsWith("WindowShutters_")) return "Windows";
  if (file.startsWith("Roof_") || file.startsWith("Overhang_")) return "Roofs";
  if (file.startsWith("Stair_") || file.startsWith("Stairs_")) return "Stairs";
  if (file.startsWith("Prop_")) return "Props";
  if (file.startsWith("Balcony_")) return "Balconies";
  return "Decorations";
}

function splitFileTokens(file) {
  return file
    .split(TOKEN_SPLIT_PATTERN)
    .map((token) => token.trim())
    .filter(Boolean);
}

function toLabel(file) {
  return splitFileTokens(file)
    .map((token) => {
      if (/^\d+x\d+$/i.test(token)) return token.toLowerCase();
      if (/^\d+$/.test(token)) return token;
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(" ");
}

function toSlug(file) {
  return splitFileTokens(file)
    .map((token) => token.toLowerCase())
    .join("-");
}

function dedupe(values) {
  return [...new Set(values)];
}

function toTags(file, category) {
  const parts = splitFileTokens(file).map((token) => token.toLowerCase());
  const expanded = parts.flatMap((token) => {
    if (token === "wooddark") return ["wood", "dark"];
    if (token === "woodlight") return ["wood", "light"];
    if (token === "redbrick") return ["red", "brick"];
    if (token === "unevenbrick" || token === "unevenbricks") return ["uneven", "brick"];
    if (token === "roundtiles") return ["round", "tiles"];
    if (token === "roundtile") return ["round", "tile"];
    if (token === "wide" || token === "thin" || token === "flat" || token === "round") return [token];
    if (token === "l" || token === "r" || token === "u") return [token];
    if (token === "doorframe") return ["door", "frame"];
    if (token === "windowshutters") return ["window", "shutters"];
    if (token === "exteriorwide") return ["exterior", "wide"];
    if (token === "singleside") return ["single", "side"];
    if (token === "sideplatform") return ["side", "platform"];
    if (token === "nofirststep") return ["no", "first", "step"];
    if (token === "solidextended") return ["solid", "extended"];
    if (token === "roundinset") return ["round", "inset"];
    return [token];
  });

  return dedupe([category.toLowerCase(), ...expanded]);
}

function placeholderFor(category, tags) {
  if (category === "Walls" || category === "Doors" || category === "Windows") {
    return {
      shape: "box",
      size: [2, 2.5, 0.25],
      color: category === "Doors" ? "#a1887f" : "#8d6e63",
    };
  }
  if (category === "Floors") {
    return { shape: "box", size: [2, 0.2, 2], color: "#546e7a" };
  }
  if (category === "Corners") {
    return { shape: "box", size: [1.4, 2.4, 1.4], color: "#795548" };
  }
  if (category === "Roofs") {
    return { shape: "box", size: [2.2, 0.6, 2.2], color: "#5d4037" };
  }
  if (category === "Stairs") {
    return { shape: "box", size: [2, 1.4, 2], color: "#7b8d93" };
  }
  if (category === "Balconies") {
    return { shape: "box", size: [2, 1.2, 1], color: "#607d8b" };
  }
  if (tags.includes("vine")) {
    return { shape: "column", size: [0.5, 1.8, 0.5], color: "#689f38" };
  }
  return { shape: "box", size: [1, 1, 1], color: "#8bc34a" };
}

function listAssetBaseNames() {
  return fs
    .readdirSync(ASSET_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".gltf"))
    .map((entry) => entry.name.replace(/\.gltf$/iu, ""));
}

function buildManifestFromDisk() {
  const assets = listAssetBaseNames()
    .map((baseName) => {
      const category = detectCategory(baseName);
      const tags = toTags(baseName, category);
      return {
        id: toSlug(baseName),
        name: toLabel(baseName),
        category,
        fileName: `${baseName}.gltf`,
        thumbnailFileName: `${baseName}.png`,
        tags,
        placeholder: placeholderFor(category, tags),
      };
    })
    .sort((left, right) => {
      const categoryDelta = (CATEGORY_ORDER.get(left.category) ?? 0) - (CATEGORY_ORDER.get(right.category) ?? 0);
      return categoryDelta !== 0 ? categoryDelta : left.name.localeCompare(right.name);
    });

  return {
    version: 1,
    assets,
  };
}

function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

function writeManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
}

function writeScreenshotManifest(manifest) {
  fs.mkdirSync(path.dirname(SCREENSHOT_MANIFEST_PATH), { recursive: true });
  const screenshotManifest = {
    generatedAt: new Date().toISOString(),
    basePath: "/assets/glTF/",
    files: manifest.assets.map((asset) => asset.fileName),
  };
  fs.writeFileSync(SCREENSHOT_MANIFEST_PATH, JSON.stringify(screenshotManifest, null, 2) + "\n");
}

function isExternalUri(uri) {
  return typeof uri === "string" && !uri.startsWith("data:") && !/^[a-z]+:/iu.test(uri);
}

function validateGltfSidecars(fileName) {
  const errors = [];
  const warnings = [];
  const assetPath = path.join(ASSET_DIR, fileName);

  try {
    const gltf = JSON.parse(fs.readFileSync(assetPath, "utf8"));
    const buffers = Array.isArray(gltf.buffers) ? gltf.buffers : [];
    const images = Array.isArray(gltf.images) ? gltf.images : [];

    buffers.forEach((buffer, index) => {
      if (!buffer || typeof buffer !== "object") {
        warnings.push(`${fileName}: buffers[${index}] is invalid.`);
        return;
      }
      if (!isExternalUri(buffer.uri)) {
        return;
      }
      const bufferPath = path.join(ASSET_DIR, buffer.uri);
      if (!fs.existsSync(bufferPath)) {
        errors.push(`${fileName}: missing buffer sidecar ${buffer.uri}`);
      }
    });

    images.forEach((image, index) => {
      if (!image || typeof image !== "object") {
        warnings.push(`${fileName}: images[${index}] is invalid.`);
        return;
      }
      if (!isExternalUri(image.uri)) {
        return;
      }
      const imagePath = path.join(ASSET_DIR, image.uri);
      if (!fs.existsSync(imagePath)) {
        errors.push(`${fileName}: missing texture sidecar ${image.uri}`);
      }
    });
  } catch (error) {
    errors.push(
      `${fileName}: could not parse glTF JSON (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  return { errors, warnings };
}

function validateManifest(manifest) {
  const errors = [];
  const warnings = [];

  if (!manifest || typeof manifest !== "object" || manifest.version !== 1 || !Array.isArray(manifest.assets)) {
    errors.push("Manifest must contain version 1 and an assets array.");
    return { errors, warnings };
  }

  const ids = new Set();
  const fileNames = new Set();
  const thumbnailFileNames = new Set();
  const diskBaseNames = new Set(listAssetBaseNames());
  const diskThumbnailNames = fs.existsSync(THUMBNAIL_DIR)
    ? new Set(
        fs
          .readdirSync(THUMBNAIL_DIR, { withFileTypes: true })
          .filter((entry) => entry.isFile() && entry.name.endsWith(".png"))
          .map((entry) => entry.name),
      )
    : new Set();

  manifest.assets.forEach((asset, index) => {
    const prefix = `assets[${index}]`;
    if (!asset || typeof asset !== "object") {
      errors.push(`${prefix} must be an object.`);
      return;
    }

    if (typeof asset.id !== "string" || !asset.id) errors.push(`${prefix}.id must be a non-empty string.`);
    if (typeof asset.name !== "string" || !asset.name) errors.push(`${prefix}.name must be a non-empty string.`);
    if (!ASSET_CATEGORIES.includes(asset.category)) errors.push(`${prefix}.category is invalid.`);
    if (typeof asset.fileName !== "string" || !asset.fileName.endsWith(".gltf")) {
      errors.push(`${prefix}.fileName must be a .gltf file.`);
    }
    if (typeof asset.thumbnailFileName !== "string" || !asset.thumbnailFileName.endsWith(".png")) {
      errors.push(`${prefix}.thumbnailFileName must be a .png file.`);
    }
    if (!Array.isArray(asset.tags) || asset.tags.some((tag) => typeof tag !== "string")) {
      errors.push(`${prefix}.tags must be a string array.`);
    }
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

      const assetPath = path.join(ASSET_DIR, asset.fileName);
      if (!fs.existsSync(assetPath)) {
        errors.push(`Missing asset file: ${asset.fileName}`);
      }

      const baseName = asset.fileName.replace(/\.gltf$/iu, "");
      diskBaseNames.delete(baseName);

      const sidecarResults = validateGltfSidecars(asset.fileName);
      errors.push(...sidecarResults.errors);
      warnings.push(...sidecarResults.warnings);
    }

    if (typeof asset.thumbnailFileName === "string") {
      if (thumbnailFileNames.has(asset.thumbnailFileName)) {
        errors.push(`Duplicate thumbnailFileName: ${asset.thumbnailFileName}`);
      }
      thumbnailFileNames.add(asset.thumbnailFileName);

      const thumbnailPath = path.join(THUMBNAIL_DIR, asset.thumbnailFileName);
      if (!fs.existsSync(thumbnailPath)) {
        warnings.push(`Missing thumbnail: ${asset.thumbnailFileName}`);
      } else {
        diskThumbnailNames.delete(asset.thumbnailFileName);
      }
    }
  });

  Array.from(diskBaseNames)
    .sort((left, right) => left.localeCompare(right))
    .forEach((baseName) => {
      warnings.push(`Unmanifested asset file on disk: ${baseName}.gltf`);
    });

  Array.from(diskThumbnailNames)
    .sort((left, right) => left.localeCompare(right))
    .forEach((fileName) => {
      warnings.push(`Orphan thumbnail on disk: ${fileName}`);
    });

  return { errors, warnings };
}

function printResults(results) {
  if (results.errors.length === 0 && results.warnings.length === 0) {
    console.log("Asset library is valid.");
    return;
  }

  if (results.errors.length > 0) {
    console.error("Errors:");
    results.errors.forEach((entry) => console.error(`- ${entry}`));
  }

  if (results.warnings.length > 0) {
    console.warn("Warnings:");
    results.warnings.forEach((entry) => console.warn(`- ${entry}`));
  }
}

function main() {
  const mode = process.argv[2] ?? "validate";

  if (mode === "regenerate") {
    const nextManifest = buildManifestFromDisk();
    writeManifest(nextManifest);
    console.log(`Regenerated asset manifest with ${nextManifest.assets.length} entries.`);
    const results = validateManifest(nextManifest);
    printResults(results);
    process.exit(results.errors.length > 0 ? 1 : 0);
  }

  if (mode === "thumbnails") {
    const manifest = loadManifest();
    const results = validateManifest(manifest);
    printResults(results);
    if (results.errors.length > 0) {
      process.exit(1);
    }

    writeScreenshotManifest(manifest);
    console.log(`Wrote screenshot queue manifest to ${path.relative(ROOT, SCREENSHOT_MANIFEST_PATH)}.`);
    process.exit(0);
  }

  if (mode === "validate") {
    const manifest = loadManifest();
    const results = validateManifest(manifest);
    printResults(results);
    process.exit(results.errors.length > 0 ? 1 : 0);
  }

  console.error(`Unknown mode: ${mode}`);
  console.error("Usage: node scripts/asset-library.mjs [validate|regenerate|thumbnails]");
  process.exit(1);
}

main();
