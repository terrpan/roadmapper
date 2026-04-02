/**
 * @deprecated This localStorage adapter is kept for static demo mode (e.g., GitHub Pages).
 * It will be removed when a backend API is always available.
 * Use the StorageAdapter interface from storageAdapter.ts instead.
 */

import type { RoadmapItem, Connection, Group, Milestone, ItemStatus } from '../types';
import type { StorageAdapter, RoadmapData } from './storageAdapter';

const STORAGE_KEY = 'roadmapper-data';

/** @deprecated — kept for static demo mode (GitHub Pages) */
export function loadFromStorage<T>(key: string = STORAGE_KEY): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** @deprecated — kept for static demo mode (GitHub Pages) */
export function saveToStorage<T>(data: T, key: string = STORAGE_KEY): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    console.error('Failed to save to localStorage');
  }
}

/**
 * @deprecated LocalStorageAdapter is kept for static demo mode (e.g., GitHub Pages).
 * It will be removed when a backend API is always available.
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly mode = 'local' as const;

  private getData(): RoadmapData {
    return loadFromStorage<RoadmapData>(STORAGE_KEY) ?? { items: [], connections: [], groups: [] };
  }

  private setData(data: RoadmapData): void {
    saveToStorage(data, STORAGE_KEY);
  }

  async loadAll(): Promise<RoadmapData> {
    return this.getData();
  }

  async saveAll(data: RoadmapData): Promise<void> {
    this.setData(data);
  }

  async saveItem(item: RoadmapItem): Promise<RoadmapItem> {
    const data = this.getData();
    data.items.push(item);
    this.setData(data);
    return item;
  }

  async updateItem(id: string, updates: Partial<Omit<RoadmapItem, 'id'>>): Promise<RoadmapItem> {
    const data = this.getData();
    const idx = data.items.findIndex(i => i.id === id);
    if (idx === -1) throw new Error(`Item ${id} not found`);
    data.items[idx] = { ...data.items[idx], ...updates };
    this.setData(data);
    return data.items[idx];
  }

  async deleteItem(id: string): Promise<void> {
    const data = this.getData();
    const deletedItem = data.items.find(i => i.id === id);
    const newParentId = deletedItem?.parentId;
    data.items = data.items
      .filter(i => i.id !== id)
      .map(i => i.parentId === id ? { ...i, parentId: newParentId } : i);
    data.connections = data.connections.filter(c => c.sourceId !== id && c.targetId !== id);
    data.groups = data.groups
      .map(g => g.itemIds.includes(id) ? { ...g, itemIds: g.itemIds.filter(iid => iid !== id) } : g)
      .filter(g => g.itemIds.length > 0);
    this.setData(data);
  }

  async updateItemPosition(id: string, position: { x: number; y: number }): Promise<void> {
    const data = this.getData();
    data.items = data.items.map(i => i.id === id ? { ...i, position } : i);
    this.setData(data);
  }

  async updateItemStatus(id: string, status: string): Promise<RoadmapItem[]> {
    const data = this.getData();
    data.items = data.items.map(i => i.id === id ? { ...i, status: status as ItemStatus } : i);

    // Cascading completion
    if (status === 'done') {
      const childIds = new Set<string>();
      const queue = [id];
      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const conn of data.connections) {
          if (conn.sourceId === current && !childIds.has(conn.targetId)) {
            childIds.add(conn.targetId);
            queue.push(conn.targetId);
          }
        }
      }
      if (childIds.size > 0) {
        data.items = data.items.map(i => childIds.has(i.id) ? { ...i, status: 'done' as ItemStatus } : i);
      }
    }

    this.setData(data);
    return data.items;
  }

  async batchUpdatePositions(updates: Array<{ id: string; position: { x: number; y: number } }>): Promise<void> {
    const data = this.getData();
    const posMap = new Map(updates.map(u => [u.id, u.position]));
    data.items = data.items.map(i => posMap.has(i.id) ? { ...i, position: posMap.get(i.id)! } : i);
    this.setData(data);
  }

  async saveConnection(connection: Connection): Promise<Connection> {
    const data = this.getData();
    data.connections.push(connection);
    this.setData(data);
    return connection;
  }

  async updateConnection(id: string, updates: Partial<Omit<Connection, 'id'>>): Promise<Connection> {
    const data = this.getData();
    const idx = data.connections.findIndex(c => c.id === id);
    if (idx === -1) throw new Error(`Connection ${id} not found`);
    data.connections[idx] = { ...data.connections[idx], ...updates };
    this.setData(data);
    return data.connections[idx];
  }

  async deleteConnection(id: string): Promise<void> {
    const data = this.getData();
    data.connections = data.connections.filter(c => c.id !== id);
    this.setData(data);
  }

  async saveGroup(group: Group): Promise<Group> {
    const data = this.getData();
    data.groups.push(group);
    this.setData(data);
    return group;
  }

  async updateGroup(id: string, updates: Partial<Omit<Group, 'id'>>): Promise<Group> {
    const data = this.getData();
    const idx = data.groups.findIndex(g => g.id === id);
    if (idx === -1) throw new Error(`Group ${id} not found`);
    data.groups[idx] = { ...data.groups[idx], ...updates };
    this.setData(data);
    return data.groups[idx];
  }

  async deleteGroup(id: string): Promise<void> {
    const data = this.getData();
    data.groups = data.groups.filter(g => g.id !== id);
    this.setData(data);
  }

  async addItemsToGroup(groupId: string, itemIds: string[]): Promise<Group> {
    const data = this.getData();
    const idx = data.groups.findIndex(g => g.id === groupId);
    if (idx === -1) throw new Error(`Group ${groupId} not found`);
    data.groups[idx] = {
      ...data.groups[idx],
      itemIds: [...new Set([...data.groups[idx].itemIds, ...itemIds])],
    };
    this.setData(data);
    return data.groups[idx];
  }

  async removeItemFromGroup(groupId: string, itemId: string): Promise<Group> {
    const data = this.getData();
    const idx = data.groups.findIndex(g => g.id === groupId);
    if (idx === -1) throw new Error(`Group ${groupId} not found`);
    data.groups[idx] = {
      ...data.groups[idx],
      itemIds: data.groups[idx].itemIds.filter(id => id !== itemId),
    };
    this.setData(data);
    return data.groups[idx];
  }

  async saveMilestone(itemId: string, milestone: Milestone): Promise<Milestone> {
    const data = this.getData();
    data.items = data.items.map(i =>
      i.id === itemId ? { ...i, milestones: [...i.milestones, milestone] } : i
    );
    this.setData(data);
    return milestone;
  }

  async deleteMilestone(itemId: string, milestoneId: string): Promise<void> {
    const data = this.getData();
    data.items = data.items.map(i =>
      i.id === itemId ? { ...i, milestones: i.milestones.filter(m => m.id !== milestoneId) } : i
    );
    this.setData(data);
  }

  async toggleMilestone(itemId: string, milestoneId: string): Promise<Milestone> {
    const data = this.getData();
    let toggled: Milestone | null = null;
    data.items = data.items.map(i => {
      if (i.id !== itemId) return i;
      return {
        ...i,
        milestones: i.milestones.map(m => {
          if (m.id !== milestoneId) return m;
          toggled = { ...m, completed: !m.completed };
          return toggled;
        }),
      };
    });
    this.setData(data);
    if (!toggled) throw new Error(`Milestone ${milestoneId} not found`);
    return toggled;
  }

  async importData(data: RoadmapData, mode: 'replace' | 'merge'): Promise<RoadmapData> {
    if (mode === 'replace') {
      this.setData(data);
      return data;
    }
    const existing = this.getData();
    const existingItemIds = new Set(existing.items.map(i => i.id));
    const existingConnIds = new Set(existing.connections.map(c => c.id));
    const existingGroupIds = new Set(existing.groups.map(g => g.id));
    const merged: RoadmapData = {
      items: [...existing.items, ...data.items.filter(i => !existingItemIds.has(i.id))],
      connections: [...existing.connections, ...data.connections.filter(c => !existingConnIds.has(c.id))],
      groups: [...existing.groups, ...data.groups.filter(g => !existingGroupIds.has(g.id))],
    };
    this.setData(merged);
    return merged;
  }

  async exportData(): Promise<RoadmapData> {
    return this.getData();
  }
}
