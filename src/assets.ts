import librariesManifest from "./data/libraries.json";
import builtInLibraryMeta from "./data/libraries/built-in/library.json";
import assetCategoriesManifest from "./data/libraries/built-in/asset-categories.json";
import assetsManifest from "./data/libraries/built-in/assets-manifest.json";

export const GRID_SIZES = [2, 1, 0.5, 0.25, 0.125] as const;
export const ROTATION_STEPS = [90, 45, 15] as const;

interface AssetCategoryManifest {
  version: 1;
  categories: string[];
}

export interface LibraryRegistryEntry {
  id: string;
  name: string;
  mode: "built-in" | "imported";
  metaPath: string;
}

interface LibraryRegistryManifest {
  version: 1;
  libraries: LibraryRegistryEntry[];
}

export interface AssetLibraryMeta {
  version: 1;
  id: string;
  name: string;
  mode: "built-in" | "imported";
  description: string;
  author: string;
  createdAt: string;
  assetManifest: string;
  categories: string;
  tagTemplates: string;
  assetBasePath: string;
  thumbnailBasePath: string;
}

export interface AssetLibraryBundle {
  library: LibraryRegistryEntry;
  meta: AssetLibraryMeta;
  assets: AssetDefinition[];
  categories: string[];
  metaUrl?: string;
}

function parseAssetCategoryManifest(value: unknown): AssetCategoryManifest {
  if (!value || typeof value !== "object") {
    throw new Error("Asset category manifest must be an object.");
  }

  const candidate = value as Partial<AssetCategoryManifest>;
  if (candidate.version !== 1 || !Array.isArray(candidate.categories)) {
    throw new Error("Asset category manifest must include version 1 and a categories array.");
  }

  if (candidate.categories.length === 0 || candidate.categories.some((category) => typeof category !== "string" || category.trim().length === 0)) {
    throw new Error("Asset category manifest contains an invalid category.");
  }

  const seenCategories = new Set<string>();
  candidate.categories.forEach((category) => {
    if (seenCategories.has(category)) {
      throw new Error(`Asset category manifest contains a duplicate category: ${category}`);
    }
    seenCategories.add(category);
  });

  return {
    version: 1,
    categories: [...candidate.categories],
  };
}

function parseLibraryRegistryManifest(value: unknown): LibraryRegistryManifest {
  if (!value || typeof value !== "object") {
    throw new Error("Library registry manifest must be an object.");
  }

  const candidate = value as Partial<LibraryRegistryManifest>;
  if (candidate.version !== 1 || !Array.isArray(candidate.libraries)) {
    throw new Error("Library registry manifest must include version 1 and a libraries array.");
  }

  const ids = new Set<string>();
  candidate.libraries.forEach((library, index) => {
    if (!library || typeof library !== "object") {
      throw new Error(`Library registry entry ${index} is invalid.`);
    }
    if (typeof library.id !== "string" || !library.id) {
      throw new Error(`Library registry entry ${index} must have a non-empty id.`);
    }
    if (typeof library.name !== "string" || !library.name) {
      throw new Error(`Library registry entry ${index} must have a non-empty name.`);
    }
    if (library.mode !== "built-in" && library.mode !== "imported") {
      throw new Error(`Library registry entry ${index} has an invalid mode.`);
    }
    if (typeof library.metaPath !== "string" || !library.metaPath) {
      throw new Error(`Library registry entry ${index} must have a metaPath.`);
    }
    if (ids.has(library.id)) {
      throw new Error(`Library registry contains a duplicate library id: ${library.id}`);
    }
    ids.add(library.id);
  });

  return {
    version: 1,
    libraries: candidate.libraries,
  };
}

function parseAssetLibraryMeta(value: unknown): AssetLibraryMeta {
  if (!value || typeof value !== "object") {
    throw new Error("Asset library metadata must be an object.");
  }

  const candidate = value as Partial<AssetLibraryMeta>;
  if (
    candidate.version !== 1 ||
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    (candidate.mode !== "built-in" && candidate.mode !== "imported") ||
    typeof candidate.description !== "string" ||
    typeof candidate.author !== "string" ||
    typeof candidate.createdAt !== "string" ||
    typeof candidate.assetManifest !== "string" ||
    typeof candidate.categories !== "string" ||
    typeof candidate.tagTemplates !== "string" ||
    typeof candidate.assetBasePath !== "string" ||
    typeof candidate.thumbnailBasePath !== "string"
  ) {
    throw new Error("Asset library metadata is invalid.");
  }

  return {
    version: 1,
    id: candidate.id,
    name: candidate.name,
    mode: candidate.mode,
    description: candidate.description,
    author: candidate.author,
    createdAt: candidate.createdAt,
    assetManifest: candidate.assetManifest,
    categories: candidate.categories,
    tagTemplates: candidate.tagTemplates,
    assetBasePath: candidate.assetBasePath,
    thumbnailBasePath: candidate.thumbnailBasePath,
  };
}

export const LIBRARIES = parseLibraryRegistryManifest(librariesManifest).libraries;
export const BUILT_IN_LIBRARY = parseAssetLibraryMeta(builtInLibraryMeta);
export const ACTIVE_LIBRARY = (() => {
  const builtInEntry = LIBRARIES.find((library) => library.id === BUILT_IN_LIBRARY.id);
  if (!builtInEntry) {
    throw new Error(`Library registry is missing the built-in library entry: ${BUILT_IN_LIBRARY.id}`);
  }
  if (builtInEntry.metaPath !== "./libraries/built-in/library.json") {
    throw new Error(`Built-in library registry entry points to an unexpected metadata path: ${builtInEntry.metaPath}`);
  }
  return BUILT_IN_LIBRARY;
})();
export const ASSET_CATEGORIES = parseAssetCategoryManifest(assetCategoriesManifest).categories;
export type AssetCategory = string;
export type PlaceholderShape = "box" | "column";

export interface AssetDefinition {
  id: string;
  name: string;
  category: AssetCategory;
  fileName: string;
  thumbnailFileName: string;
  defaultPlacementKind?: "clone" | "instance";
  tags: string[];
  placeholder: {
    shape: PlaceholderShape;
    size: [number, number, number];
    color: string;
  };
}

export interface AssetRef {
  libraryId: string;
  assetId: string;
}

interface AssetLibraryManifest {
  version: 1;
  assets: AssetDefinition[];
}

function isAssetDefinition(value: unknown, categorySet: Set<string>): value is AssetDefinition {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AssetDefinition>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.category === "string" &&
    categorySet.has(candidate.category) &&
    typeof candidate.fileName === "string" &&
    typeof candidate.thumbnailFileName === "string" &&
    (candidate.defaultPlacementKind === undefined ||
      candidate.defaultPlacementKind === "clone" ||
      candidate.defaultPlacementKind === "instance") &&
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

function parseAssetManifest(value: unknown, categories: string[]): AssetLibraryManifest {
  if (!value || typeof value !== "object") {
    throw new Error("Asset manifest must be an object.");
  }

  const candidate = value as Partial<AssetLibraryManifest>;
  if (candidate.version !== 1 || !Array.isArray(candidate.assets)) {
    throw new Error("Asset manifest must include version 1 and an assets array.");
  }

  const categorySet = new Set<string>(categories);
  if (!candidate.assets.every((asset) => isAssetDefinition(asset, categorySet))) {
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

export const ASSETS: AssetDefinition[] = parseAssetManifest(assetsManifest, ASSET_CATEGORIES).assets;
const BUILT_IN_LIBRARY_BUNDLES: AssetLibraryBundle[] = [
  {
    library: LIBRARIES.find((library) => library.id === ACTIVE_LIBRARY.id)!,
    meta: ACTIVE_LIBRARY,
    assets: ASSETS,
    categories: ASSET_CATEGORIES,
  },
];

let importedLibraryBundles: AssetLibraryBundle[] = [];

export function getAssetLibraryBundles() {
  return [...BUILT_IN_LIBRARY_BUNDLES, ...importedLibraryBundles];
}

export function getAssetLibraryBundle(libraryId: string) {
  return getAssetLibraryBundles().find((bundle) => bundle.library.id === libraryId) ?? BUILT_IN_LIBRARY_BUNDLES[0];
}

export function createAssetRef(libraryId: string, assetId: string): AssetRef {
  return { libraryId, assetId };
}

export function getAssetRefKey(asset: AssetRef) {
  return `${asset.libraryId}:${asset.assetId}`;
}

export function parseAssetRefKey(value: string): AssetRef {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex === -1) {
    return { libraryId: ACTIVE_LIBRARY.id, assetId: value };
  }

  return {
    libraryId: value.slice(0, separatorIndex),
    assetId: value.slice(separatorIndex + 1),
  };
}

export function findAssetByRef(assetRef: AssetRef) {
  const bundle = getAssetLibraryBundle(assetRef.libraryId);
  return bundle.assets.find((asset) => asset.id === assetRef.assetId) ?? null;
}

export function findAssetByKey(value: string) {
  return findAssetByRef(parseAssetRefKey(value));
}

export function getAssetBasePath() {
  return ACTIVE_LIBRARY.assetBasePath;
}

export function getAssetBasePathForLibrary(libraryId: string) {
  return getAssetLibraryBundle(libraryId).meta.assetBasePath;
}

export function getAssetThumbnailBasePath() {
  return ACTIVE_LIBRARY.thumbnailBasePath;
}

export function getAssetThumbnailBasePathForLibrary(libraryId: string) {
  return getAssetLibraryBundle(libraryId).meta.thumbnailBasePath;
}

export function getAssetFileUrl(fileName: string) {
  return `${getAssetBasePath()}${fileName}`;
}

export function getAssetThumbnailUrl(thumbnailFileName: string) {
  return `${getAssetThumbnailBasePath()}${thumbnailFileName}`;
}

export function getAssetThumbnailUrlForLibrary(libraryId: string, thumbnailFileName: string) {
  return `${getAssetThumbnailBasePathForLibrary(libraryId)}${thumbnailFileName}`;
}

export function splitAssetFileReference(fileName: string) {
  const normalized = fileName.replace(/\\/g, "/");
  const slashIndex = normalized.lastIndexOf("/");
  if (slashIndex === -1) {
    return {
      directory: "",
      fileName: normalized,
    };
  }

  return {
    directory: normalized.slice(0, slashIndex + 1),
    fileName: normalized.slice(slashIndex + 1),
  };
}

function resolveUrl(baseUrl: string, relativeOrAbsoluteUrl: string) {
  const absoluteBaseUrl = /^[a-z]+:/iu.test(baseUrl)
    ? baseUrl
    : new URL(baseUrl, typeof document !== "undefined" ? document.baseURI : "http://localhost/").toString();
  return new URL(relativeOrAbsoluteUrl, absoluteBaseUrl).toString();
}

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

async function loadImportedLibraryBundle(entry: LibraryRegistryEntry, registryUrl: string) {
  const metaUrl = resolveUrl(registryUrl, entry.metaPath);
  const meta = parseAssetLibraryMeta(await fetchJson(metaUrl));
  const categories = parseAssetCategoryManifest(await fetchJson(resolveUrl(metaUrl, meta.categories))).categories;
  const assets = parseAssetManifest(await fetchJson(resolveUrl(metaUrl, meta.assetManifest)), categories).assets;

  return {
    library: entry,
    meta: {
      ...meta,
      assetBasePath: resolveUrl(metaUrl, meta.assetBasePath),
      thumbnailBasePath: resolveUrl(metaUrl, meta.thumbnailBasePath),
    },
    assets,
    categories,
    metaUrl,
  } satisfies AssetLibraryBundle;
}

export async function loadImportedLibraryBundles() {
  const registryUrl = "/libraries/libraries.json";
  let manifest: LibraryRegistryManifest;

  try {
    manifest = parseLibraryRegistryManifest(await fetchJson(registryUrl));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("404")) {
      importedLibraryBundles = [];
      return getAssetLibraryBundles();
    }
    throw error;
  }

  const builtInIds = new Set(BUILT_IN_LIBRARY_BUNDLES.map((bundle) => bundle.library.id));
  const externalEntries = manifest.libraries.filter((library) => !builtInIds.has(library.id));
  importedLibraryBundles = await Promise.all(externalEntries.map((entry) => loadImportedLibraryBundle(entry, registryUrl)));
  return getAssetLibraryBundles();
}
