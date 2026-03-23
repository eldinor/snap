import { parseSerializedAssetScene, type SerializedAssetScene } from "./scene-serialization";

// v2 intentionally ignores legacy autosaves after editor state changes that were
// causing broken restored sessions in some browser profiles.
const AUTOSAVE_STORAGE_KEY = "snap.asset-scene-autosave.v2";
const AUTOSAVE_HISTORY_STORAGE_KEY = "snap.asset-scene-autosave-history.v2";
const MANUAL_SAVE_STORAGE_KEY = "snap.asset-scene-manual-save.v1";
const MAX_AUTOSAVE_HISTORY_ENTRIES = 10;

interface AutosavedSceneEnvelope {
  version: 1;
  savedAt: string;
  scene: SerializedAssetScene;
}

export interface LoadedAutosavedScene {
  savedAt: string;
  scene: SerializedAssetScene;
}

export interface LoadedSavedScene {
  savedAt: string;
  scene: SerializedAssetScene;
}

interface AutosavedSceneHistoryEnvelope {
  version: 1;
  entries: AutosavedSceneEnvelope[];
}

function parseStoredSceneEnvelope(raw: string | null): LoadedSavedScene | null {
  if (!raw) {
    return null;
  }

  const candidate = JSON.parse(raw) as Partial<AutosavedSceneEnvelope>;
  if (candidate.version !== 1 || typeof candidate.savedAt !== "string") {
    return null;
  }

  const scene = parseSerializedAssetScene(candidate.scene);
  if (!scene) {
    return null;
  }

  return {
    savedAt: candidate.savedAt,
    scene,
  };
}

export function loadAutosavedScene(): LoadedAutosavedScene | null {
  try {
    return parseStoredSceneEnvelope(window.localStorage.getItem(AUTOSAVE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveAutosavedScene(scene: SerializedAssetScene) {
  const savedAt = new Date().toISOString();
  const payload: AutosavedSceneEnvelope = {
    version: 1,
    savedAt,
    scene,
  };

  try {
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore persistence failures so the editor keeps working normally.
  }

  return savedAt;
}

export function loadLatestAutosaveVersion(): LoadedAutosavedScene | null {
  try {
    const raw = window.localStorage.getItem(AUTOSAVE_HISTORY_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const candidate = JSON.parse(raw) as Partial<AutosavedSceneHistoryEnvelope>;
    if (candidate.version !== 1 || !Array.isArray(candidate.entries) || candidate.entries.length === 0) {
      return null;
    }

    for (let index = candidate.entries.length - 1; index >= 0; index -= 1) {
      const entry = candidate.entries[index];
      const parsed = parseStoredSceneEnvelope(JSON.stringify(entry));
      if (parsed) {
        return parsed;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function saveAutosaveVersion(scene: SerializedAssetScene) {
  const savedAt = new Date().toISOString();
  const payload: AutosavedSceneEnvelope = {
    version: 1,
    savedAt,
    scene,
  };

  try {
    const existingRaw = window.localStorage.getItem(AUTOSAVE_HISTORY_STORAGE_KEY);
    const existing = existingRaw ? (JSON.parse(existingRaw) as Partial<AutosavedSceneHistoryEnvelope>) : null;
    const entries = Array.isArray(existing?.entries) ? existing.entries.slice() : [];
    entries.push(payload);
    const nextPayload: AutosavedSceneHistoryEnvelope = {
      version: 1,
      entries: entries.slice(-MAX_AUTOSAVE_HISTORY_ENTRIES),
    };
    window.localStorage.setItem(AUTOSAVE_HISTORY_STORAGE_KEY, JSON.stringify(nextPayload));
  } catch {
    // Ignore persistence failures so the editor keeps working normally.
  }

  return savedAt;
}

export function loadManualSavedScene(): LoadedSavedScene | null {
  try {
    return parseStoredSceneEnvelope(window.localStorage.getItem(MANUAL_SAVE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveManualSavedScene(scene: SerializedAssetScene) {
  const savedAt = new Date().toISOString();
  const payload: AutosavedSceneEnvelope = {
    version: 1,
    savedAt,
    scene,
  };

  try {
    window.localStorage.setItem(MANUAL_SAVE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore persistence failures so the editor keeps working normally.
  }

  return savedAt;
}
