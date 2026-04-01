import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { RoadmapItem, Connection, ConnectionType, Milestone, ItemStatus, InitiativeSize, DateRange, ViewMode } from '../types';
import { loadFromStorage, saveToStorage } from '../lib/storage';

interface PersistedState {
  items: RoadmapItem[];
  connections: Connection[];
}

interface RoadmapStore extends PersistedState {
  viewMode: ViewMode;
  selectedItemId: string | null;
  dialogOpen: boolean;
  editingItemId: string | null;
  scopeItemId: string | null;

  // View
  setViewMode: (mode: ViewMode) => void;

  // Scope
  setScopeItem: (id: string | null) => void;

  // Selection
  selectItem: (id: string | null) => void;

  // Dialog
  openCreateDialog: () => void;
  openEditDialog: (id: string) => void;
  closeDialog: () => void;

  // Items
  addItem: (title: string, description: string, status: ItemStatus, position?: { x: number; y: number }, size?: InitiativeSize, dateRange?: DateRange, parentId?: string) => string;
  addItemAndConnect: (sourceId: string, direction?: 'right' | 'down') => string;
  updateItem: (id: string, updates: Partial<Omit<RoadmapItem, 'id'>>) => void;
  deleteItem: (id: string) => void;
  updateItemPosition: (id: string, position: { x: number; y: number }) => void;
  updateItemStatus: (id: string, status: ItemStatus) => void;

  // Batch
  batchUpdatePositions: (updates: Array<{ id: string; position: { x: number; y: number } }>) => void;

  // Hierarchy
  setParent: (itemId: string, parentId: string | null) => void;

  // Connections
  addConnection: (sourceId: string, targetId: string, label?: string, type?: ConnectionType) => void;
  updateConnectionType: (connectionId: string, type: ConnectionType) => void;
  removeConnection: (id: string) => void;

  // Milestones
  addMilestone: (itemId: string, title: string) => void;
  removeMilestone: (itemId: string, milestoneId: string) => void;
  toggleMilestone: (itemId: string, milestoneId: string) => void;
}

const persisted = loadFromStorage<PersistedState>() ?? { items: [], connections: [] };

function persist(state: PersistedState) {
  saveToStorage({ items: state.items, connections: state.connections });
}

// Cascading completion: when an item is marked 'done', mark all downstream children as 'done' too
function cascadeCompletion(items: RoadmapItem[], connections: Connection[], changedId: string, newStatus: ItemStatus): RoadmapItem[] {
  if (newStatus !== 'done') return items;

  const childIds = new Set<string>();
  const queue = [changedId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const conn of connections) {
      if (conn.sourceId === current && !childIds.has(conn.targetId)) {
        childIds.add(conn.targetId);
        queue.push(conn.targetId);
      }
    }
  }

  if (childIds.size === 0) return items;
  return items.map((item) => (childIds.has(item.id) ? { ...item, status: 'done' as ItemStatus } : item));
}

export const useRoadmapStore = create<RoadmapStore>((set, get) => ({
  items: persisted.items,
  connections: persisted.connections,
  viewMode: 'canvas',
  selectedItemId: null,
  dialogOpen: false,
  editingItemId: null,
  scopeItemId: null,

  setViewMode: (mode) => set({ viewMode: mode }),

  setScopeItem: (id) => set({ scopeItemId: id }),

  selectItem: (id) => set({ selectedItemId: id }),

  openCreateDialog: () => set({ dialogOpen: true, editingItemId: null }),
  openEditDialog: (id) => set({ dialogOpen: true, editingItemId: id }),
  closeDialog: () => set({ dialogOpen: false, editingItemId: null }),

  addItem: (title, description, status, position, size, dateRange, parentId) => {
    const id = nanoid();
    const newItem: RoadmapItem = {
      id,
      title,
      description,
      status,
      size,
      dateRange,
      parentId,
      milestones: [],
      position: position ?? { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
    };
    set((state) => {
      const next = { ...state, items: [...state.items, newItem] };
      persist(next);
      return next;
    });
    return id;
  },

  addItemAndConnect: (sourceId, direction) => {
    const store = get();
    const source = store.items.find((item) => item.id === sourceId);
    const dir = direction ?? 'right';
    const position = source
      ? dir === 'down'
        ? { x: source.position.x, y: source.position.y + 200 }
        : { x: source.position.x + 300, y: source.position.y }
      : { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 };
    const status = source?.status ?? 'planned';

    const id = nanoid();
    const newItem: RoadmapItem = {
      id,
      title: 'New Item',
      description: '',
      status,
      milestones: [],
      position,
    };

    set((state) => {
      const next = {
        ...state,
        items: [...state.items, newItem],
        connections: [...state.connections, { id: nanoid(), sourceId, targetId: id, type: 'direct' as const }],
        dialogOpen: true,
        editingItemId: id,
      };
      persist(next);
      return next;
    });
    return id;
  },

  updateItem: (id, updates) =>
    set((state) => {
      let items = state.items.map((item) => (item.id === id ? { ...item, ...updates } : item));
      if (updates.status) {
        items = cascadeCompletion(items, state.connections, id, updates.status);
      }
      const next = { ...state, items };
      persist(next);
      return next;
    }),

  deleteItem: (id) =>
    set((state) => {
      const deletedItem = state.items.find((i) => i.id === id);
      const newParentId = deletedItem?.parentId;
      const next = {
        ...state,
        items: state.items
          .filter((item) => item.id !== id)
          .map((item) => item.parentId === id ? { ...item, parentId: newParentId } : item),
        connections: state.connections.filter((c) => c.sourceId !== id && c.targetId !== id),
        selectedItemId: state.selectedItemId === id ? null : state.selectedItemId,
      };
      persist(next);
      return next;
    }),

  updateItemPosition: (id, position) => {
    const store = get();
    const next = {
      items: store.items.map((item) => (item.id === id ? { ...item, position } : item)),
      connections: store.connections,
    };
    persist(next);
    set({ items: next.items });
  },

  batchUpdatePositions: (updates) => {
    set((state) => {
      const posMap = new Map(updates.map((u) => [u.id, u.position]));
      const next = {
        ...state,
        items: state.items.map((item) =>
          posMap.has(item.id) ? { ...item, position: posMap.get(item.id)! } : item
        ),
      };
      persist(next);
      return next;
    });
  },

  updateItemStatus: (id, status) =>
    set((state) => {
      let items = state.items.map((item) => (item.id === id ? { ...item, status } : item));
      items = cascadeCompletion(items, state.connections, id, status);
      const next = { ...state, items };
      persist(next);
      return next;
    }),

  setParent: (itemId, parentId) =>
    set((state) => {
      const next = {
        ...state,
        items: state.items.map((item) =>
          item.id === itemId ? { ...item, parentId: parentId ?? undefined } : item
        ),
      };
      persist(next);
      return next;
    }),

  addConnection: (sourceId, targetId, label, type) =>
    set((state) => {
      const exists = state.connections.some(
        (c) => c.sourceId === sourceId && c.targetId === targetId
      );
      if (exists) return state;
      const next = {
        ...state,
        connections: [...state.connections, { id: nanoid(), sourceId, targetId, label, type: type ?? 'direct' }],
      };
      persist(next);
      return next;
    }),

  updateConnectionType: (connectionId, type) =>
    set((state) => {
      const next = {
        ...state,
        connections: state.connections.map((c) =>
          c.id === connectionId ? { ...c, type } : c
        ),
      };
      persist(next);
      return next;
    }),

  removeConnection: (id) =>
    set((state) => {
      const next = {
        ...state,
        connections: state.connections.filter((c) => c.id !== id),
      };
      persist(next);
      return next;
    }),

  addMilestone: (itemId, title) =>
    set((state) => {
      const next = {
        ...state,
        items: state.items.map((item) =>
          item.id === itemId
            ? { ...item, milestones: [...item.milestones, { id: nanoid(), title, completed: false }] }
            : item
        ),
      };
      persist(next);
      return next;
    }),

  removeMilestone: (itemId, milestoneId) =>
    set((state) => {
      const next = {
        ...state,
        items: state.items.map((item) =>
          item.id === itemId
            ? { ...item, milestones: item.milestones.filter((m: Milestone) => m.id !== milestoneId) }
            : item
        ),
      };
      persist(next);
      return next;
    }),

  toggleMilestone: (itemId, milestoneId) =>
    set((state) => {
      const next = {
        ...state,
        items: state.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                milestones: item.milestones.map((m: Milestone) =>
                  m.id === milestoneId ? { ...m, completed: !m.completed } : m
                ),
              }
            : item
        ),
      };
      persist(next);
      return next;
    }),
}));
