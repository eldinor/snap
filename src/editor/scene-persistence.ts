import { parseSerializedAssetScene, type SerializedAssetScene } from "./scene-serialization";

const AUTOSAVE_STORAGE_KEY = "snap.asset-scene-autosave.v1";

interface AutosavedSceneEnvelope {
  version: 1;
  savedAt: string;
  scene: SerializedAssetScene;
}

export interface LoadedAutosavedScene {
  savedAt: string;
  scene: SerializedAssetScene;
}

export function loadAutosavedScene(): LoadedAutosavedScene | null {
  try {
    const raw = window.localStorage.getItem(AUTOSAVE_STORAGE_KEY);
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
  } catch {
    return null;
  }
}

export function saveAutosavedScene(scene: SerializedAssetScene) {
  const payload: AutosavedSceneEnvelope = {
    version: 1,
    savedAt: new Date().toISOString(),
    scene,
  };

  try {
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore persistence failures so the editor keeps working normally.
  }
}
