import { ImportMeshAsync, type ISceneLoaderAsyncResult } from "@babylonjs/core/Loading/sceneLoader";
import type { Scene } from "@babylonjs/core/scene";
import { splitAssetFileReference, type AssetDefinition, type AssetLibraryBundle } from "./assets";

const CACHE_DB_NAME = "snap-asset-library-cache";
const CACHE_DB_VERSION = 1;
const LIBRARY_META_STORE = "libraryMeta";
const LIBRARY_FILE_STORE = "libraryFiles";

interface CachedLibraryMetaRecord {
  libraryId: string;
  revision: string;
  warmedAt: string;
  fileCount: number;
  totalBytes: number;
}

interface CachedLibraryFileRecord {
  key: string;
  libraryId: string;
  revision: string;
  filePath: string;
  blob: Blob;
  size: number;
  updatedAt: string;
}

export interface AssetLibraryCacheState {
  kind: "unavailable" | "not_warmed" | "outdated" | "warmed";
  currentRevision: string;
  warmedRevision: string | null;
  warmedAt: string | null;
  fileCount: number;
  totalBytes: number;
}

export interface AssetLibraryWarmProgress {
  completedAssets: number;
  totalAssets: number;
  currentAssetId: string;
  filesDiscovered: number;
  bytesDownloaded: number;
}

let openDatabasePromise: Promise<IDBDatabase> | null = null;

export function isAssetLibraryCacheSupported() {
  return typeof indexedDB !== "undefined";
}

function openDatabase() {
  if (!isAssetLibraryCacheSupported()) {
    return Promise.reject(new Error("IndexedDB is not available in this browser."));
  }

  if (!openDatabasePromise) {
    openDatabasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(LIBRARY_META_STORE)) {
          database.createObjectStore(LIBRARY_META_STORE, { keyPath: "libraryId" });
        }

        if (!database.objectStoreNames.contains(LIBRARY_FILE_STORE)) {
          const store = database.createObjectStore(LIBRARY_FILE_STORE, { keyPath: "key" });
          store.createIndex("byLibraryId", "libraryId", { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error ?? new Error("Could not open the asset cache database."));
      };
    });
  }

  return openDatabasePromise;
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed."));
    };
  });
}

function transactionToPromise(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = () => {
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    };
  });
}

function createFileKey(libraryId: string, filePath: string) {
  return `${libraryId}:${filePath}`;
}

function resolveUrl(baseUrl: string, relativeOrAbsoluteUrl: string) {
  const absoluteBaseUrl = /^[a-z]+:/iu.test(baseUrl)
    ? baseUrl
    : new URL(baseUrl, typeof document !== "undefined" ? document.baseURI : "http://localhost/").toString();
  return new URL(relativeOrAbsoluteUrl, absoluteBaseUrl).toString();
}

function isDataUri(value: string) {
  return value.startsWith("data:");
}

function isExternalUri(value: string) {
  return /^[a-z]+:/iu.test(value) || value.startsWith("//");
}

function normalizeLibraryPath(value: string) {
  return value
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".")
    .reduce<string[]>((segments, segment) => {
      if (segment === "..") {
        segments.pop();
        return segments;
      }
      segments.push(segment);
      return segments;
    }, [])
    .join("/");
}

function resolveRelativeLibraryPath(currentFilePath: string, nextPath: string) {
  const currentDirectory = splitAssetFileReference(currentFilePath).directory;
  const resolved = new URL(nextPath, `https://snap-cache.local/${currentDirectory}`);
  return normalizeLibraryPath(decodeURIComponent(resolved.pathname.slice(1)));
}

function collectObjectUris(value: unknown, currentFilePath: string, target: Set<string>) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      collectObjectUris(entry, currentFilePath, target);
    });
    return;
  }

  Object.entries(value as Record<string, unknown>).forEach(([key, nextValue]) => {
    if (key === "uri" && typeof nextValue === "string" && !isDataUri(nextValue) && !isExternalUri(nextValue)) {
      target.add(resolveRelativeLibraryPath(currentFilePath, nextValue));
      return;
    }

    collectObjectUris(nextValue, currentFilePath, target);
  });
}

function collectReferencedLibraryPaths(gltfText: string, currentFilePath: string) {
  const parsed = JSON.parse(gltfText) as unknown;
  const referencedPaths = new Set<string>();
  collectObjectUris(parsed, currentFilePath, referencedPaths);
  return referencedPaths;
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function computeAssetLibraryRevision(bundle: AssetLibraryBundle) {
  return hashString(
    JSON.stringify({
      library: bundle.library,
      meta: bundle.meta,
      categories: bundle.categories,
      assets: bundle.assets,
    }),
  );
}

async function getLibraryMetaRecord(libraryId: string) {
  if (!isAssetLibraryCacheSupported()) {
    return null;
  }

  const database = await openDatabase();
  const transaction = database.transaction(LIBRARY_META_STORE, "readonly");
  const store = transaction.objectStore(LIBRARY_META_STORE);
  const result = (await requestToPromise(
    store.get(libraryId),
  )) as CachedLibraryMetaRecord | undefined;
  return result ?? null;
}

async function getCachedFileRecord(libraryId: string, filePath: string) {
  if (!isAssetLibraryCacheSupported()) {
    return null;
  }

  const database = await openDatabase();
  const transaction = database.transaction(LIBRARY_FILE_STORE, "readonly");
  const store = transaction.objectStore(LIBRARY_FILE_STORE);
  const result = (await requestToPromise(
    store.get(createFileKey(libraryId, filePath)),
  )) as CachedLibraryFileRecord | undefined;
  return result ?? null;
}

export async function getAssetLibraryCacheState(bundle: AssetLibraryBundle): Promise<AssetLibraryCacheState> {
  const currentRevision = computeAssetLibraryRevision(bundle);
  if (!isAssetLibraryCacheSupported()) {
    return {
      kind: "unavailable",
      currentRevision,
      warmedRevision: null,
      warmedAt: null,
      fileCount: 0,
      totalBytes: 0,
    };
  }

  const meta = await getLibraryMetaRecord(bundle.library.id);
  if (!meta) {
    return {
      kind: "not_warmed",
      currentRevision,
      warmedRevision: null,
      warmedAt: null,
      fileCount: 0,
      totalBytes: 0,
    };
  }

  return {
    kind: meta.revision === currentRevision ? "warmed" : "outdated",
    currentRevision,
    warmedRevision: meta.revision,
    warmedAt: meta.warmedAt,
    fileCount: meta.fileCount,
    totalBytes: meta.totalBytes,
  };
}

async function fetchLibraryFile(basePath: string, filePath: string) {
  const response = await fetch(resolveUrl(basePath, filePath), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${filePath}: ${response.status}`);
  }
  return response.blob();
}

async function collectLibraryFiles(
  basePath: string,
  filePath: string,
  files: Map<string, Blob>,
  counters: { bytesDownloaded: number },
) {
  const normalizedPath = normalizeLibraryPath(filePath);
  if (files.has(normalizedPath)) {
    return;
  }

  const blob = await fetchLibraryFile(basePath, normalizedPath);
  files.set(normalizedPath, blob);
  counters.bytesDownloaded += blob.size;

  if (!normalizedPath.toLowerCase().endsWith(".gltf")) {
    return;
  }

  const referencedPaths = collectReferencedLibraryPaths(await blob.text(), normalizedPath);
  for (const referencedPath of referencedPaths) {
    await collectLibraryFiles(basePath, referencedPath, files, counters);
  }
}

export async function warmAssetLibrary(
  bundle: AssetLibraryBundle,
  onProgress?: (progress: AssetLibraryWarmProgress) => void,
) {
  if (!isAssetLibraryCacheSupported()) {
    throw new Error("IndexedDB is not available in this browser.");
  }

  const files = new Map<string, Blob>();
  const counters = { bytesDownloaded: 0 };

  for (let index = 0; index < bundle.assets.length; index += 1) {
    const asset = bundle.assets[index];
    await collectLibraryFiles(bundle.meta.assetBasePath, asset.fileName, files, counters);
    onProgress?.({
      completedAssets: index + 1,
      totalAssets: bundle.assets.length,
      currentAssetId: asset.id,
      filesDiscovered: files.size,
      bytesDownloaded: counters.bytesDownloaded,
    });
  }

  const database = await openDatabase();
  const transaction = database.transaction([LIBRARY_META_STORE, LIBRARY_FILE_STORE], "readwrite");
  const metaStore = transaction.objectStore(LIBRARY_META_STORE);
  const fileStore = transaction.objectStore(LIBRARY_FILE_STORE);
  const revision = computeAssetLibraryRevision(bundle);
  const updatedAt = new Date().toISOString();
  let totalBytes = 0;

  files.forEach((blob, filePath) => {
    totalBytes += blob.size;
    fileStore.put({
      key: createFileKey(bundle.library.id, filePath),
      libraryId: bundle.library.id,
      revision,
      filePath,
      blob,
      size: blob.size,
      updatedAt,
    } satisfies CachedLibraryFileRecord);
  });

  metaStore.put({
    libraryId: bundle.library.id,
    revision,
    warmedAt: updatedAt,
    fileCount: files.size,
    totalBytes,
  } satisfies CachedLibraryMetaRecord);

  await transactionToPromise(transaction);
}

function rewriteGltfUris(
  value: unknown,
  currentFilePath: string,
  objectUrls: Map<string, string>,
): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => rewriteGltfUris(entry, currentFilePath, objectUrls));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nextValue]) => {
      if (key === "uri" && typeof nextValue === "string" && !isDataUri(nextValue) && !isExternalUri(nextValue)) {
        const resolvedPath = resolveRelativeLibraryPath(currentFilePath, nextValue);
        return [key, objectUrls.get(resolvedPath) ?? nextValue];
      }

      return [key, rewriteGltfUris(nextValue, currentFilePath, objectUrls)];
    }),
  );
}

async function buildCachedGltfData(libraryId: string, filePath: string) {
  const normalizedFilePath = normalizeLibraryPath(filePath);
  const cachedEntry = await getCachedFileRecord(libraryId, normalizedFilePath);
  if (!cachedEntry) {
    return null;
  }

  const entryText = await cachedEntry.blob.text();
  const parsed = JSON.parse(entryText) as unknown;
  const referencedPaths = collectReferencedLibraryPaths(entryText, normalizedFilePath);
  const objectUrls = new Map<string, string>();

  try {
    for (const referencedPath of referencedPaths) {
      const cachedDependency = await getCachedFileRecord(libraryId, referencedPath);
      if (!cachedDependency) {
        objectUrls.forEach((objectUrl) => {
          URL.revokeObjectURL(objectUrl);
        });
        return null;
      }
      objectUrls.set(referencedPath, URL.createObjectURL(cachedDependency.blob));
    }

    const rewritten = rewriteGltfUris(parsed, normalizedFilePath, objectUrls);
    return {
      data: JSON.stringify(rewritten),
      dispose: () => {
        objectUrls.forEach((objectUrl) => {
          URL.revokeObjectURL(objectUrl);
        });
      },
    };
  } catch (error) {
    objectUrls.forEach((objectUrl) => {
      URL.revokeObjectURL(objectUrl);
    });
    throw error;
  }
}

export async function importAssetFromLibraryCache(
  bundle: AssetLibraryBundle,
  asset: AssetDefinition,
  scene: Scene,
): Promise<ISceneLoaderAsyncResult | null> {
  const state = await getAssetLibraryCacheState(bundle);
  if (state.kind !== "warmed") {
    return null;
  }

  const normalizedFilePath = normalizeLibraryPath(asset.fileName);
  const lowerPath = normalizedFilePath.toLowerCase();

  if (lowerPath.endsWith(".gltf")) {
    const cachedData = await buildCachedGltfData(bundle.library.id, normalizedFilePath);
    if (!cachedData) {
      return null;
    }

    try {
      return await ImportMeshAsync(`data:${cachedData.data}`, scene, {
        meshNames: "",
        rootUrl: "",
        pluginExtension: ".gltf",
      });
    } finally {
      cachedData.dispose();
    }
  }

  if (lowerPath.endsWith(".glb")) {
    const cachedFile = await getCachedFileRecord(bundle.library.id, normalizedFilePath);
    if (!cachedFile) {
      return null;
    }

    const binary = new Uint8Array(await cachedFile.blob.arrayBuffer());
    return ImportMeshAsync(binary, scene, {
      meshNames: "",
      rootUrl: "",
      pluginExtension: ".glb",
      name: splitAssetFileReference(normalizedFilePath).fileName,
    });
  }

  return null;
}
