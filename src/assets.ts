import assetsManifest from "./data/assets-manifest.json";

export const GRID_SIZES = [2, 1, 0.5, 0.25, 0.125] as const;
export const ROTATION_STEPS = [90, 45, 15] as const;

export const ASSET_CATEGORIES = [
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
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];
export type PlaceholderShape = "box" | "column";

export interface AssetDefinition {
  id: string;
  name: string;
  category: AssetCategory;
  fileName: string;
  thumbnailFileName: string;
  tags: string[];
  placeholder: {
    shape: PlaceholderShape;
    size: [number, number, number];
    color: string;
  };
}

interface AssetLibraryManifest {
  version: 1;
  assets: AssetDefinition[];
}

const CATEGORY_SET = new Set<string>(ASSET_CATEGORIES);

function isAssetDefinition(value: unknown): value is AssetDefinition {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AssetDefinition>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.category === "string" &&
    CATEGORY_SET.has(candidate.category) &&
    typeof candidate.fileName === "string" &&
    typeof candidate.thumbnailFileName === "string" &&
    Array.isArray(candidate.tags) &&
    candidate.tags.every((tag) => typeof tag === "string") &&
    !!candidate.placeholder &&
    typeof candidate.placeholder === "object" &&
    (candidate.placeholder.shape === "box" || candidate.placeholder.shape === "column") &&
    Array.isArray(candidate.placeholder.size) &&
    candidate.placeholder.size.length === 3 &&
    candidate.placeholder.size.every((component) => typeof component === "number") &&
    typeof candidate.placeholder.color === "string"
  );
}

function parseAssetManifest(value: unknown): AssetLibraryManifest {
  if (!value || typeof value !== "object") {
    throw new Error("Asset manifest must be an object.");
  }

  const candidate = value as Partial<AssetLibraryManifest>;
  if (candidate.version !== 1 || !Array.isArray(candidate.assets)) {
    throw new Error("Asset manifest must include version 1 and an assets array.");
  }

  if (!candidate.assets.every(isAssetDefinition)) {
    throw new Error("Asset manifest contains an invalid asset entry.");
  }

  const ids = new Set<string>();
  candidate.assets.forEach((asset) => {
    if (ids.has(asset.id)) {
      throw new Error(`Asset manifest contains a duplicate asset id: ${asset.id}`);
    }
    ids.add(asset.id);
  });

  return {
    version: 1,
    assets: candidate.assets,
  };
}

export const ASSETS: AssetDefinition[] = parseAssetManifest(assetsManifest).assets;
