export const USER_SETTINGS_STORAGE_KEY = "snap:user-settings";

export interface UserSettings {
  environmentEnabled: boolean;
  environmentIntensity: number;
  lightIntensity: number;
  gridVisible: boolean;
  gridColor: string;
  groundColor: string;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  environmentEnabled: true,
  environmentIntensity: 0.1,
  lightIntensity: 1.1,
  gridVisible: true,
  gridColor: "#292f38",
  groundColor: "#1f2326",
};

export function loadUserSettings(storageKey = USER_SETTINGS_STORAGE_KEY): UserSettings {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return { ...DEFAULT_USER_SETTINGS };
    }

    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      environmentEnabled: parsed.environmentEnabled ?? DEFAULT_USER_SETTINGS.environmentEnabled,
      environmentIntensity: parsed.environmentIntensity ?? DEFAULT_USER_SETTINGS.environmentIntensity,
      lightIntensity: parsed.lightIntensity ?? DEFAULT_USER_SETTINGS.lightIntensity,
      gridVisible: parsed.gridVisible ?? DEFAULT_USER_SETTINGS.gridVisible,
      gridColor: typeof parsed.gridColor === "string" ? parsed.gridColor : DEFAULT_USER_SETTINGS.gridColor,
      groundColor: typeof parsed.groundColor === "string" ? parsed.groundColor : DEFAULT_USER_SETTINGS.groundColor,
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
