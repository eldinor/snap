export const USER_SETTINGS_STORAGE_KEY = "snap:user-settings";

export interface UserSettings {
  environmentEnabled: boolean;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  environmentEnabled: false,
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
    };
  } catch {
    return { ...DEFAULT_USER_SETTINGS };
  }
}

export function saveUserSettings(settings: UserSettings, storageKey = USER_SETTINGS_STORAGE_KEY) {
  window.localStorage.setItem(storageKey, JSON.stringify(settings));
}
