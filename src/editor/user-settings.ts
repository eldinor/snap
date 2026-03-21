export const USER_SETTINGS_STORAGE_KEY = "snap:user-settings";

export const GRID_SIZE_OPTIONS = [2, 1, 0.5, 0.25, 0.125] as const;
export const GRID_PLANE_SIZE_OPTIONS = [16, 32, 64, 128, 256] as const;

export interface UserSettings {
  saveOnEveryUiUpdate: boolean;
  autosaveEnabled: boolean;
  autosaveIntervalSeconds: number;
  environmentEnabled: boolean;
  environmentIntensity: number;
  lightIntensity: number;
  gridVisible: boolean;
  gridPlaneSize: number;
  gridColor: string;
  groundColor: string;
  freezeModelMaterials: boolean;
  newObjectPlacementKind: "clone" | "instance";
  heightLabelMode: "transform" | "geometry";
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  saveOnEveryUiUpdate: true,
  autosaveEnabled: true,
  autosaveIntervalSeconds: 30,
  environmentEnabled: true,
  environmentIntensity: 0.1,
  lightIntensity: 1.1,
  gridVisible: true,
  gridPlaneSize: 64,
  gridColor: "#292f38",
  groundColor: "#1f2326",
  freezeModelMaterials: true,
  newObjectPlacementKind: "instance",
  heightLabelMode: "transform",
};

export function loadUserSettings(storageKey = USER_SETTINGS_STORAGE_KEY): UserSettings {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return { ...DEFAULT_USER_SETTINGS };
    }

    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      saveOnEveryUiUpdate: parsed.saveOnEveryUiUpdate ?? DEFAULT_USER_SETTINGS.saveOnEveryUiUpdate,
      autosaveEnabled: parsed.autosaveEnabled ?? DEFAULT_USER_SETTINGS.autosaveEnabled,
      autosaveIntervalSeconds:
        parsed.autosaveIntervalSeconds === 15 ||
        parsed.autosaveIntervalSeconds === 30 ||
        parsed.autosaveIntervalSeconds === 60 ||
        parsed.autosaveIntervalSeconds === 120 ||
        parsed.autosaveIntervalSeconds === 300
          ? parsed.autosaveIntervalSeconds
          : DEFAULT_USER_SETTINGS.autosaveIntervalSeconds,
      environmentEnabled: parsed.environmentEnabled ?? DEFAULT_USER_SETTINGS.environmentEnabled,
      environmentIntensity: parsed.environmentIntensity ?? DEFAULT_USER_SETTINGS.environmentIntensity,
      lightIntensity: parsed.lightIntensity ?? DEFAULT_USER_SETTINGS.lightIntensity,
      gridVisible: parsed.gridVisible ?? DEFAULT_USER_SETTINGS.gridVisible,
      gridPlaneSize: GRID_PLANE_SIZE_OPTIONS.includes(parsed.gridPlaneSize as (typeof GRID_PLANE_SIZE_OPTIONS)[number])
        ? (parsed.gridPlaneSize as number)
        : DEFAULT_USER_SETTINGS.gridPlaneSize,
      gridColor: typeof parsed.gridColor === "string" ? parsed.gridColor : DEFAULT_USER_SETTINGS.gridColor,
      groundColor: typeof parsed.groundColor === "string" ? parsed.groundColor : DEFAULT_USER_SETTINGS.groundColor,
      freezeModelMaterials: parsed.freezeModelMaterials ?? DEFAULT_USER_SETTINGS.freezeModelMaterials,
      newObjectPlacementKind:
        parsed.newObjectPlacementKind === "clone" || parsed.newObjectPlacementKind === "instance"
          ? parsed.newObjectPlacementKind
          : DEFAULT_USER_SETTINGS.newObjectPlacementKind,
      heightLabelMode:
        parsed.heightLabelMode === "transform" || parsed.heightLabelMode === "geometry"
          ? parsed.heightLabelMode
          : DEFAULT_USER_SETTINGS.heightLabelMode,
    };
  } catch {
    return { ...DEFAULT_USER_SETTINGS };
  }
}

export function saveUserSettings(settings: UserSettings, storageKey = USER_SETTINGS_STORAGE_KEY) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(settings));
  } catch {
    // Ignore persistence failures so the editor keeps working normally.
  }
}
