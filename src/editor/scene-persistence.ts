import { parseSerializedAssetScene, type SerializedAssetScene } from "./scene-serialization";

const AUTOSAVE_STORAGE_KEY = "snap.asset-scene-autosave.v1";
const MANUAL_SAVE_STORAGE_KEY = "snap.asset-scene-manual-save.v1";

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
