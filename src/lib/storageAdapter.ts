import type { RoadmapItem, Connection, Group, Milestone, RoadmapData } from '../types';

export type { RoadmapData };

/**
 * StorageAdapter abstracts persistence so the app can work in both
 * localStorage mode (static demo / GitHub Pages) and API mode (full deployment).
 */
export interface StorageAdapter {
  readonly mode: 'local' | 'api';

  // Bulk operations
  loadAll(): Promise<RoadmapData>;
  saveAll(data: RoadmapData): Promise<void>;

  // Items
  saveItem(item: RoadmapItem): Promise<RoadmapItem>;
  updateItem(id: string, updates: Partial<Omit<RoadmapItem, 'id'>>): Promise<RoadmapItem>;
  deleteItem(id: string): Promise<void>;
  updateItemPosition(id: string, position: { x: number; y: number }): Promise<void>;
  updateItemStatus(id: string, status: string): Promise<RoadmapItem[]>;
  batchUpdatePositions(updates: Array<{ id: string; position: { x: number; y: number } }>): Promise<void>;

  // Connections
  saveConnection(connection: Connection): Promise<Connection>;
  updateConnection(id: string, updates: Partial<Omit<Connection, 'id'>>): Promise<Connection>;
  deleteConnection(id: string): Promise<void>;

  // Groups
  saveGroup(group: Group): Promise<Group>;
  updateGroup(id: string, updates: Partial<Omit<Group, 'id'>>): Promise<Group>;
  deleteGroup(id: string): Promise<void>;
  addItemsToGroup(groupId: string, itemIds: string[]): Promise<Group>;
  removeItemFromGroup(groupId: string, itemId: string): Promise<Group>;

  // Milestones
  saveMilestone(itemId: string, milestone: Milestone): Promise<Milestone>;
  deleteMilestone(itemId: string, milestoneId: string): Promise<void>;
  toggleMilestone(itemId: string, milestoneId: string): Promise<Milestone>;

  // Import/Export
  importData(data: RoadmapData, mode: 'replace' | 'merge'): Promise<RoadmapData>;
  exportData(): Promise<RoadmapData>;
}

/** Detect whether API is available by probing health endpoint */
async function isApiAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { method: 'GET', signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Resolve which storage mode to use */
export async function resolveStorageMode(): Promise<'local' | 'api'> {
  const explicit = import.meta.env.VITE_STORAGE_MODE;
  if (explicit === 'api') return 'api';
  if (explicit === 'local') return 'local';
  return (await isApiAvailable()) ? 'api' : 'local';
}

let _adapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!_adapter) throw new Error('StorageAdapter not initialized. Call initStorageAdapter() first.');
  return _adapter;
}

export function setStorageAdapter(adapter: StorageAdapter): void {
  _adapter = adapter;
}
