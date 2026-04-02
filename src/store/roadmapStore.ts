import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { RoadmapItem, Connection, ConnectionType, Milestone, ItemStatus, InitiativeSize, DateRange, ViewMode, Group } from '../types';
import { GROUP_COLORS, getItemDepth } from '../types';
import { getStorageAdapter } from '../lib/storageAdapter';
import type { StorageAdapter } from '../lib/storageAdapter';

interface PersistedState {
  items: RoadmapItem[];
  connections: Connection[];
  groups: Group[];
}

interface RoadmapStore extends PersistedState {
  viewMode: ViewMode;
  selectedItemId: string | null;
  dialogOpen: boolean;
  editingItemId: string | null;
  scopeItemId: string | null;
  parentForNewItem: string | null;
  directionForNewItem: 'right' | 'down' | null;
  selectedNodeIds: string[];
  searchQuery: string;
  connectingFrom: { nodeId: string; type: ConnectionType } | null;

  // View
  setViewMode: (mode: ViewMode) => void;

  // Scope
  setScopeItem: (id: string | null) => void;

  // Selection
  selectItem: (id: string | null) => void;
  setSelectedNodeIds: (ids: string[]) => void;

  // Search
  setSearchQuery: (query: string) => void;

  // Connect mode (one-shot: pick a target node)
  setConnectingFromNode: (id: string | null, type?: ConnectionType) => void;

  // Dialog
  openCreateDialog: () => void;
  openEditDialog: (id: string) => void;
  closeDialog: () => void;
  prepareNewItemWithParent: (parentId: string, direction?: 'right' | 'down') => void;

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

  // Groups
  addGroup: (label: string, itemIds: string[]) => string;
  updateGroup: (id: string, updates: Partial<Omit<Group, 'id'>>) => void;
  deleteGroup: (id: string) => void;
  removeItemFromGroup: (groupId: string, itemId: string) => void;
  addItemsToGroup: (groupId: string, itemIds: string[]) => void;

  // Import
  importData: (data: { items: RoadmapItem[]; connections: Connection[]; groups?: Group[] }, mode: 'replace' | 'merge') => void;

  // Initialization
  _initialized: boolean;
  initializeFromStorage: () => Promise<void>;
}

const initialState: PersistedState = { items: [], connections: [], groups: [] };

// Fire-and-forget async sync to storage adapter
function syncToAdapter(fn: (adapter: StorageAdapter) => Promise<void>) {
  try {
    const adapter = getStorageAdapter();
    fn(adapter).catch((err) => console.error('Storage sync failed:', err));
  } catch {
    // Adapter not initialized yet — ignore
  }
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
  items: initialState.items,
  connections: initialState.connections,
  groups: initialState.groups,
  _initialized: false,
  viewMode: 'canvas',
  selectedItemId: null,
  dialogOpen: false,
  editingItemId: null,
  scopeItemId: null,
  parentForNewItem: null,
  directionForNewItem: null,
  selectedNodeIds: [],
  searchQuery: '',
  connectingFrom: null,

  initializeFromStorage: async () => {
    const adapter = getStorageAdapter();
    const data = await adapter.loadAll();
    set({ items: data.items, connections: data.connections, groups: data.groups, _initialized: true });
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setScopeItem: (id) => set({ scopeItemId: id }),

  selectItem: (id) => set({ selectedItemId: id }),
  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setConnectingFromNode: (id, type = 'direct') =>
    set({ connectingFrom: id ? { nodeId: id, type } : null }),

  openCreateDialog: () => set({ dialogOpen: true, editingItemId: null }),
  openEditDialog: (id) => set({ dialogOpen: true, editingItemId: id }),
  closeDialog: () => set({ dialogOpen: false, editingItemId: null, parentForNewItem: null, directionForNewItem: null }),

  prepareNewItemWithParent: (parentId, direction) =>
    set({ dialogOpen: true, editingItemId: null, parentForNewItem: parentId, directionForNewItem: direction ?? 'right' }),

  addItem: (title, description, status, position, size, dateRange, parentId) => {
    const id = nanoid();
    const store = get();
    const actualParentId = parentId ?? store.parentForNewItem ?? undefined;

    // Node dimensions (approximate)
    const NODE_W = 220;
    const NODE_H = 120;

    let itemPosition = position;
    if (!itemPosition && actualParentId && store.directionForNewItem) {
      const parent = store.items.find((item) => item.id === actualParentId);
      if (parent) {
        const dir = store.directionForNewItem;
        const siblings = store.items.filter((item) => item.parentId === actualParentId);

        if (dir === 'down') {
          // Children go in a row below the parent, spreading right
          const childY = parent.position.y + NODE_H + 80;
          if (siblings.length === 0) {
            itemPosition = { x: parent.position.x, y: childY };
          } else {
            // Place to the right of the rightmost sibling at child row Y
            const rightmost = siblings.reduce((a, b) => (a.position.x > b.position.x ? a : b));
            itemPosition = { x: rightmost.position.x + NODE_W + 40, y: childY };
          }
        } else {
          // Children go in a column to the right of the parent, spreading down
          const childX = parent.position.x + NODE_W + 80;
          if (siblings.length === 0) {
            itemPosition = { x: childX, y: parent.position.y };
          } else {
            // Place below the bottommost sibling at child column X
            const bottommost = siblings.reduce((a, b) => (a.position.y > b.position.y ? a : b));
            itemPosition = { x: childX, y: bottommost.position.y + NODE_H + 40 };
          }
        }
      }
    }
    
    const newItem: RoadmapItem = {
      id,
      title,
      description,
      status,
      size,
      dateRange,
      parentId: actualParentId,
      milestones: [],
      position: itemPosition ?? { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
    };
    
    set((state) => {
      const parentConnection = actualParentId
        ? { id: nanoid(), sourceId: actualParentId, targetId: id, type: 'direct' as const }
        : null;

      syncToAdapter(async (adapter) => {
        await adapter.saveItem(newItem);
        if (parentConnection) await adapter.saveConnection(parentConnection);
      });

      return { 
        ...state, 
        items: [...state.items, newItem],
        connections: parentConnection ? [...state.connections, parentConnection] : state.connections,
        parentForNewItem: null,
        directionForNewItem: null,
      };
    });
    return id;
  },

  addItemAndConnect: (sourceId, direction) => {
    const { prepareNewItemWithParent } = get();
    prepareNewItemWithParent(sourceId, direction);
    return sourceId;
  },

  updateItem: (id, updates) =>
    set((state) => {
      let items = state.items.map((item) => (item.id === id ? { ...item, ...updates } : item));
      if (updates.status) {
        items = cascadeCompletion(items, state.connections, id, updates.status);
      }
      syncToAdapter(async (adapter) => { await adapter.updateItem(id, updates); });
      return { ...state, items };
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
        groups: state.groups
          .map((g) => g.itemIds.includes(id) ? { ...g, itemIds: g.itemIds.filter((iid) => iid !== id) } : g)
          .filter((g) => g.itemIds.length > 0),
        selectedItemId: state.selectedItemId === id ? null : state.selectedItemId,
      };
      syncToAdapter(async (adapter) => { await adapter.deleteItem(id); });
      return next;
    }),

  updateItemPosition: (id, position) => {
    // Local-only update — no API call. Use batchUpdatePositions to persist.
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, position } : item)),
    }));
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
      syncToAdapter(async (adapter) => { await adapter.batchUpdatePositions(updates); });
      return next;
    });
  },

  updateItemStatus: (id, status) =>
    set((state) => {
      let items = state.items.map((item) => (item.id === id ? { ...item, status } : item));
      items = cascadeCompletion(items, state.connections, id, status);
      syncToAdapter(async (adapter) => { await adapter.updateItemStatus(id, status); });
      return { ...state, items };
    }),

  setParent: (itemId, parentId) =>
    set((state) => {
      const next = {
        ...state,
        items: state.items.map((item) =>
          item.id === itemId ? { ...item, parentId: parentId ?? undefined } : item
        ),
      };
      syncToAdapter(async (adapter) => { await adapter.updateItem(itemId, { parentId: parentId ?? undefined }); });
      return next;
    }),

  addConnection: (sourceId, targetId, label, type) =>
    set((state) => {
      // Blocking connections only allowed between items at the same hierarchy depth
      if (type === 'blocking') {
        const srcDepth = getItemDepth(state.items, sourceId);
        const tgtDepth = getItemDepth(state.items, targetId);
        if (srcDepth !== tgtDepth) return state;
      }
      // Allow multiple connections between same nodes only if they have different types
      const exists = state.connections.some(
        (c) => c.sourceId === sourceId && c.targetId === targetId && (c.type ?? 'direct') === (type ?? 'direct')
      );
      if (exists) return state;
      const newConnection = { id: nanoid(), sourceId, targetId, label, type: type ?? 'direct' };
      syncToAdapter(async (adapter) => { await adapter.saveConnection(newConnection); });
      return {
        ...state,
        connections: [...state.connections, newConnection],
      };
    }),

  updateConnectionType: (connectionId, type) =>
    set((state) => {
      // Blocking connections only allowed between items at the same hierarchy depth
      if (type === 'blocking') {
        const conn = state.connections.find((c) => c.id === connectionId);
        if (conn) {
          const srcDepth = getItemDepth(state.items, conn.sourceId);
          const tgtDepth = getItemDepth(state.items, conn.targetId);
          if (srcDepth !== tgtDepth) return state;
        }
      }
      const next = {
        ...state,
        connections: state.connections.map((c) =>
          c.id === connectionId ? { ...c, type } : c
        ),
      };
      syncToAdapter(async (adapter) => { await adapter.updateConnection(connectionId, { type }); });
      return next;
    }),

  removeConnection: (id) =>
    set((state) => {
      const next = {
        ...state,
        connections: state.connections.filter((c) => c.id !== id),
      };
      syncToAdapter(async (adapter) => { await adapter.deleteConnection(id); });
      return next;
    }),

  addMilestone: (itemId, title) =>
    set((state) => {
      const milestone = { id: nanoid(), title, completed: false };
      syncToAdapter(async (adapter) => { await adapter.saveMilestone(itemId, milestone); });
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === itemId
            ? { ...item, milestones: [...item.milestones, milestone] }
            : item
        ),
      };
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
      syncToAdapter(async (adapter) => { await adapter.deleteMilestone(itemId, milestoneId); });
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
      syncToAdapter(async (adapter) => { await adapter.toggleMilestone(itemId, milestoneId); });
      return next;
    }),

  // Groups
  addGroup: (label, itemIds) => {
    const id = nanoid();
    set((state) => {
      const usedColors = new Set(state.groups.map((g) => g.colorIndex));
      let colorIndex = 0;
      for (let i = 0; i < GROUP_COLORS.length; i++) {
        if (!usedColors.has(i)) { colorIndex = i; break; }
      }
      const newGroup = { id, label, colorIndex, itemIds };
      syncToAdapter(async (adapter) => { await adapter.saveGroup(newGroup); });
      return {
        ...state,
        groups: [...state.groups, newGroup],
      };
    });
    return id;
  },

  updateGroup: (id, updates) =>
    set((state) => {
      const next = {
        ...state,
        groups: state.groups.map((g) => (g.id === id ? { ...g, ...updates } : g)),
      };
      syncToAdapter(async (adapter) => { await adapter.updateGroup(id, updates); });
      return next;
    }),

  deleteGroup: (id) =>
    set((state) => {
      const next = {
        ...state,
        groups: state.groups.filter((g) => g.id !== id),
      };
      syncToAdapter(async (adapter) => { await adapter.deleteGroup(id); });
      return next;
    }),

  removeItemFromGroup: (groupId, itemId) =>
    set((state) => {
      const next = {
        ...state,
        groups: state.groups
          .map((g) => (g.id === groupId ? { ...g, itemIds: g.itemIds.filter((iid) => iid !== itemId) } : g))
          .filter((g) => g.itemIds.length > 0),
      };
      syncToAdapter(async (adapter) => { await adapter.removeItemFromGroup(groupId, itemId); });
      return next;
    }),

  addItemsToGroup: (groupId, itemIds) =>
    set((state) => {
      const next = {
        ...state,
        groups: state.groups.map((g) =>
          g.id === groupId
            ? { ...g, itemIds: [...new Set([...g.itemIds, ...itemIds])] }
            : g
        ),
      };
      syncToAdapter(async (adapter) => { await adapter.addItemsToGroup(groupId, itemIds); });
      return next;
    }),

  importData: (data, mode) => {
    set((state) => {
      let next: PersistedState;
      if (mode === 'replace') {
        next = {
          ...state,
          items: data.items,
          connections: data.connections,
          groups: data.groups ?? [],
        };
      } else {
        // Merge: add new items/connections, skip duplicates by id
        const existingItemIds = new Set(state.items.map((i) => i.id));
        const existingConnIds = new Set(state.connections.map((c) => c.id));
        const existingGroupIds = new Set(state.groups.map((g) => g.id));
        next = {
          ...state,
          items: [...state.items, ...data.items.filter((i) => !existingItemIds.has(i.id))],
          connections: [...state.connections, ...data.connections.filter((c) => !existingConnIds.has(c.id))],
          groups: [...state.groups, ...(data.groups ?? []).filter((g) => !existingGroupIds.has(g.id))],
        };
      }
      return next;
    });
    // Sync to adapter and reload canonical state
    syncToAdapter(async (adapter) => {
      const result = await adapter.importData({ ...data, groups: data.groups ?? [] }, mode);
      set({ items: result.items, connections: result.connections, groups: result.groups });
    });
  },
}));
