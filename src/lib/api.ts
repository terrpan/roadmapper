import type { RoadmapItem, Connection, Group, Milestone } from '../types';
import type { StorageAdapter, RoadmapData } from './storageAdapter';

const BASE_URL = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    let message: string;
    try {
      const json = JSON.parse(body);
      message = json.error || body;
    } catch {
      message = body;
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiStorageAdapter implements StorageAdapter {
  readonly mode = 'api' as const;

  async loadAll(): Promise<RoadmapData> {
    const [items, connections, groups] = await Promise.all([
      request<RoadmapItem[]>('/api/items'),
      request<Connection[]>('/api/connections'),
      request<Group[]>('/api/groups'),
    ]);
    return {
      items: items ?? [],
      connections: connections ?? [],
      groups: groups ?? [],
    };
  }

  async saveAll(data: RoadmapData): Promise<void> {
    await request<RoadmapData>('/api/import', {
      method: 'POST',
      body: JSON.stringify({ data, mode: 'replace' }),
    });
  }

  async saveItem(item: RoadmapItem): Promise<RoadmapItem> {
    const { milestones: _milestones, ...payload } = item;
    return request<RoadmapItem>('/api/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateItem(id: string, updates: Partial<Omit<RoadmapItem, 'id'>>): Promise<RoadmapItem> {
    return request<RoadmapItem>(`/api/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteItem(id: string): Promise<void> {
    await request<void>(`/api/items/${id}`, { method: 'DELETE' });
  }

  async updateItemPosition(id: string, position: { x: number; y: number }): Promise<void> {
    await request<void>(`/api/items/${id}/position`, {
      method: 'PATCH',
      body: JSON.stringify(position),
    });
  }

  async updateItemStatus(id: string, status: string): Promise<RoadmapItem[]> {
    const res = await request<{ items: RoadmapItem[] }>(`/api/items/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return res.items;
  }

  async batchUpdatePositions(updates: Array<{ id: string; position: { x: number; y: number } }>): Promise<void> {
    await request<void>('/api/items/batch-positions', {
      method: 'POST',
      body: JSON.stringify(updates),
    });
  }

  async saveConnection(connection: Connection): Promise<Connection> {
    return request<Connection>('/api/connections', {
      method: 'POST',
      body: JSON.stringify(connection),
    });
  }

  async updateConnection(id: string, updates: Partial<Omit<Connection, 'id'>>): Promise<Connection> {
    return request<Connection>(`/api/connections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteConnection(id: string): Promise<void> {
    await request<void>(`/api/connections/${id}`, { method: 'DELETE' });
  }

  async saveGroup(group: Group): Promise<Group> {
    return request<Group>('/api/groups', {
      method: 'POST',
      body: JSON.stringify(group),
    });
  }

  async updateGroup(id: string, updates: Partial<Omit<Group, 'id'>>): Promise<Group> {
    return request<Group>(`/api/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteGroup(id: string): Promise<void> {
    await request<void>(`/api/groups/${id}`, { method: 'DELETE' });
  }

  async addItemsToGroup(groupId: string, itemIds: string[]): Promise<Group> {
    return request<Group>(`/api/groups/${groupId}/items`, {
      method: 'POST',
      body: JSON.stringify({ itemIds }),
    });
  }

  async removeItemFromGroup(groupId: string, itemId: string): Promise<Group> {
    return request<Group>(`/api/groups/${groupId}/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  async saveMilestone(itemId: string, milestone: Milestone): Promise<Milestone> {
    return request<Milestone>(`/api/items/${itemId}/milestones`, {
      method: 'POST',
      body: JSON.stringify({ id: milestone.id, title: milestone.title }),
    });
  }

  async deleteMilestone(_itemId: string, milestoneId: string): Promise<void> {
    await request<void>(`/api/milestones/${milestoneId}`, { method: 'DELETE' });
  }

  async toggleMilestone(_itemId: string, milestoneId: string): Promise<Milestone> {
    return request<Milestone>(`/api/milestones/${milestoneId}`, {
      method: 'PUT',
    });
  }

  async importData(data: RoadmapData, mode: 'replace' | 'merge'): Promise<RoadmapData> {
    return request<RoadmapData>('/api/import', {
      method: 'POST',
      body: JSON.stringify({ data, mode }),
    });
  }

  async exportData(): Promise<RoadmapData> {
    return request<RoadmapData>('/api/export');
  }
}
