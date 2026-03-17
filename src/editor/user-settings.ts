export const USER_SETTINGS_STORAGE_KEY = "snap:user-settings";

export interface UserSettings {
  environmentEnabled: boolean;
  environmentIntensity: number;
  lightIntensity: number;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  environmentEnabled: false,
  environmentIntensity: 1.75,
  lightIntensity: 1.1,
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
    };
  } catch {
    return { ...DEFAULT_USER_SETTINGS };
  }
}

export function saveUserSettings(settings: UserSettings, storageKey = USER_SETTINGS_STORAGE_KEY) {
  window.localStorage.setItem(storageKey, JSON.stringify(settings));
}
