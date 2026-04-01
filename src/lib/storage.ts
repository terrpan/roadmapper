const STORAGE_KEY = 'roadmapper-data';

export interface StorageData {
  items: Record<string, unknown>;
  connections: Record<string, unknown>;
}

export function loadFromStorage<T>(key: string = STORAGE_KEY): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveToStorage<T>(data: T, key: string = STORAGE_KEY): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    console.error('Failed to save to localStorage');
  }
}
