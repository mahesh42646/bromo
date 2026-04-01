import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'bromo_camera_settings_v1';

export type StoredCameraSettings = {
  defaultFrontCamera: boolean;
  toolbarSide: 'left' | 'right';
  allowGallerySuggestions: boolean;
};

const defaults: StoredCameraSettings = {
  defaultFrontCamera: false,
  toolbarSide: 'left',
  allowGallerySuggestions: true,
};

export async function loadCameraSettings(): Promise<StoredCameraSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export async function saveCameraSettings(p: Partial<StoredCameraSettings>): Promise<void> {
  const cur = await loadCameraSettings();
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...cur, ...p }));
}
