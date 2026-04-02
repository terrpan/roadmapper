import { z } from 'zod';
import type { RoadmapItem, Connection, Group, Milestone } from '../types';
import {
  RoadmapItemSchema,
  ConnectionSchema,
  GroupSchema,
  MilestoneSchema,
  RoadmapDataSchema,
  StatusUpdateResponseSchema,
} from '../types';
import type { StorageAdapter, RoadmapData } from './storageAdapter';

function parseResponse<T>(schema: z.ZodType<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new Error(`API response validation failed: ${err.message}`);
    }
    throw err;
  }
}

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
      request<unknown>('/api/items'),
      request<unknown>('/api/connections'),
      request<unknown>('/api/groups'),
    ]);
    return {
      items: parseResponse(z.array(RoadmapItemSchema), items ?? []),
      connections: parseResponse(z.array(ConnectionSchema), connections ?? []),
      groups: parseResponse(z.array(GroupSchema), groups ?? []),
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
    const data = await request<unknown>('/api/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return parseResponse(RoadmapItemSchema, data);
  }

  async updateItem(id: string, updates: Partial<Omit<RoadmapItem, 'id'>>): Promise<RoadmapItem> {
    const data = await request<unknown>(`/api/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return parseResponse(RoadmapItemSchema, data);
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
    const data = await request<unknown>(`/api/items/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    const res = parseResponse(StatusUpdateResponseSchema, data);
    return res.items;
  }

  async batchUpdatePositions(updates: Array<{ id: string; position: { x: number; y: number } }>): Promise<void> {
    await request<void>('/api/items/batch-positions', {
      method: 'POST',
      body: JSON.stringify(updates),
    });
  }

  async saveConnection(connection: Connection): Promise<Connection> {
    const data = await request<unknown>('/api/connections', {
      method: 'POST',
      body: JSON.stringify(connection),
    });
    return parseResponse(ConnectionSchema, data);
  }

  async updateConnection(id: string, updates: Partial<Omit<Connection, 'id'>>): Promise<Connection> {
    const data = await request<unknown>(`/api/connections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return parseResponse(ConnectionSchema, data);
  }

  async deleteConnection(id: string): Promise<void> {
    await request<void>(`/api/connections/${id}`, { method: 'DELETE' });
  }

  async saveGroup(group: Group): Promise<Group> {
    const data = await request<unknown>('/api/groups', {
      method: 'POST',
      body: JSON.stringify(group),
    });
    return parseResponse(GroupSchema, data);
  }

  async updateGroup(id: string, updates: Partial<Omit<Group, 'id'>>): Promise<Group> {
    const data = await request<unknown>(`/api/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return parseResponse(GroupSchema, data);
  }

  async deleteGroup(id: string): Promise<void> {
    await request<void>(`/api/groups/${id}`, { method: 'DELETE' });
  }

  async addItemsToGroup(groupId: string, itemIds: string[]): Promise<Group> {
    const data = await request<unknown>(`/api/groups/${groupId}/items`, {
      method: 'POST',
      body: JSON.stringify({ itemIds }),
    });
    return parseResponse(GroupSchema, data);
  }

  async removeItemFromGroup(groupId: string, itemId: string): Promise<Group> {
    const data = await request<unknown>(`/api/groups/${groupId}/items/${itemId}`, {
      method: 'DELETE',
    });
    return parseResponse(GroupSchema, data);
  }

  async saveMilestone(itemId: string, milestone: Milestone): Promise<Milestone> {
    const data = await request<unknown>(`/api/items/${itemId}/milestones`, {
      method: 'POST',
      body: JSON.stringify({ id: milestone.id, title: milestone.title }),
    });
    return parseResponse(MilestoneSchema, data);
  }

  async deleteMilestone(_itemId: string, milestoneId: string): Promise<void> {
    await request<void>(`/api/milestones/${milestoneId}`, { method: 'DELETE' });
  }

  async toggleMilestone(_itemId: string, milestoneId: string): Promise<Milestone> {
    const data = await request<unknown>(`/api/milestones/${milestoneId}`, {
      method: 'PUT',
    });
    return parseResponse(MilestoneSchema, data);
  }

  async importData(data: RoadmapData, mode: 'replace' | 'merge'): Promise<RoadmapData> {
    const res = await request<unknown>('/api/import', {
      method: 'POST',
      body: JSON.stringify({ data, mode }),
    });
    return parseResponse(RoadmapDataSchema, res);
  }

  async exportData(): Promise<RoadmapData> {
    const data = await request<unknown>('/api/export');
    return parseResponse(RoadmapDataSchema, data);
  }
}
