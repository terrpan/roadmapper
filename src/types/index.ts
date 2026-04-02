// Re-export all types from Zod schemas (single source of truth)
export type {
  ItemStatus,
  InitiativeSize,
  ConnectionType,
  ViewMode,
  DateRange,
  Milestone,
  RoadmapItem,
  Connection,
  Group,
  RoadmapData,
  Position,
  ItemFormData,
} from './schemas';

// Import types locally for use in helper functions below
import type { InitiativeSize, DateRange, RoadmapItem } from './schemas';

// Re-export schemas for runtime validation
export {
  ItemStatusSchema,
  InitiativeSizeSchema,
  ConnectionTypeSchema,
  ViewModeSchema,
  PositionSchema,
  DateRangeSchema,
  MilestoneSchema,
  RoadmapItemSchema,
  ConnectionSchema,
  GroupSchema,
  RoadmapDataSchema,
  StatusUpdateResponseSchema,
  HealthResponseSchema,
  ItemFormSchema,
  ImportDataSchema,
} from './schemas';

export const GROUP_COLORS = [
  { bg: 'rgba(99,102,241,0.08)', border: '#6366f1', label: 'Indigo' },
  { bg: 'rgba(236,72,153,0.08)', border: '#ec4899', label: 'Pink' },
  { bg: 'rgba(234,179,8,0.08)', border: '#eab308', label: 'Yellow' },
  { bg: 'rgba(34,197,94,0.08)', border: '#22c55e', label: 'Green' },
  { bg: 'rgba(239,68,68,0.08)', border: '#ef4444', label: 'Red' },
  { bg: 'rgba(168,85,247,0.08)', border: '#a855f7', label: 'Purple' },
  { bg: 'rgba(14,165,233,0.08)', border: '#0ea5e9', label: 'Sky' },
  { bg: 'rgba(249,115,22,0.08)', border: '#f97316', label: 'Orange' },
] as const;

// Helper to format a date range for display based on size
export function formatDateRange(size: InitiativeSize, range: DateRange): string {
  const start = new Date(range.start);
  const end = new Date(range.end);

  switch (size) {
    case 'weeks': {
      const startWeek = getISOWeek(start);
      const endWeek = getISOWeek(end);
      if (start.getFullYear() === end.getFullYear()) {
        return startWeek === endWeek
          ? `W${startWeek} ${start.getFullYear()}`
          : `W${startWeek}–W${endWeek} ${start.getFullYear()}`;
      }
      return `W${startWeek} ${start.getFullYear()} – W${endWeek} ${end.getFullYear()}`;
    }
    case 'months': {
      const fmt = (d: Date) => d.toLocaleString('en', { month: 'short' });
      if (start.getFullYear() === end.getFullYear()) {
        return start.getMonth() === end.getMonth()
          ? `${fmt(start)} ${start.getFullYear()}`
          : `${fmt(start)}–${fmt(end)} ${start.getFullYear()}`;
      }
      return `${fmt(start)} ${start.getFullYear()} – ${fmt(end)} ${end.getFullYear()}`;
    }
    case 'quarters': {
      const q = (d: Date) => `Q${Math.floor(d.getMonth() / 3) + 1}`;
      if (start.getFullYear() === end.getFullYear()) {
        return q(start) === q(end)
          ? `${q(start)} ${start.getFullYear()}`
          : `${q(start)}–${q(end)} ${start.getFullYear()}`;
      }
      return `${q(start)} ${start.getFullYear()} – ${q(end)} ${end.getFullYear()}`;
    }
    case 'years': {
      const sy = start.getFullYear();
      const ey = end.getFullYear();
      return sy === ey ? `${sy}` : `${sy}–${ey}`;
    }
  }
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Date range validation helpers

export function isDateRangeWithin(child: DateRange, parent: DateRange): boolean {
  return child.start >= parent.start && child.end <= parent.end;
}

export function getDateRangeViolation(child: DateRange, parent: DateRange): string | null {
  if (child.start < parent.start && child.end > parent.end) {
    return `Child extends beyond parent on both ends — starts ${parent.start} vs ${child.start}, ends ${parent.end} vs ${child.end}`;
  }
  if (child.start < parent.start) {
    return `Child starts earlier than parent (${child.start} is before parent start ${parent.start})`;
  }
  if (child.end > parent.end) {
    return `Child ends later than parent (${child.end} is after parent end ${parent.end})`;
  }
  return null;
}

// Hierarchy helpers

export function getItemChildren(items: RoadmapItem[], parentId: string): RoadmapItem[] {
  return items.filter((item) => item.parentId === parentId);
}

export function getDescendantIds(items: RoadmapItem[], itemId: string): Set<string> {
  const ids = new Set<string>();
  const queue = [itemId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const item of items) {
      if (item.parentId === current && !ids.has(item.id)) {
        ids.add(item.id);
        queue.push(item.id);
      }
    }
  }
  return ids;
}

export function getItemAncestors(items: RoadmapItem[], itemId: string): RoadmapItem[] {
  const ancestors: RoadmapItem[] = [];
  let current = items.find((i) => i.id === itemId);
  while (current?.parentId) {
    const parent = items.find((i) => i.id === current!.parentId);
    if (!parent) break;
    ancestors.push(parent);
    current = parent;
  }
  return ancestors;
}

export function computeEffectiveDateRange(item: RoadmapItem, allItems: RoadmapItem[]): DateRange | undefined {
  if (item.dateRange) return item.dateRange;
  const children = getItemChildren(allItems, item.id);
  if (children.length === 0) return undefined;

  let minStart: string | undefined;
  let maxEnd: string | undefined;
  for (const child of children) {
    const childRange = computeEffectiveDateRange(child, allItems);
    if (!childRange) continue;
    if (!minStart || childRange.start < minStart) minStart = childRange.start;
    if (!maxEnd || childRange.end > maxEnd) maxEnd = childRange.end;
  }
  return minStart && maxEnd ? { start: minStart, end: maxEnd } : undefined;
}

export function buildHierarchyTree(items: RoadmapItem[], parentId?: string): RoadmapItem[] {
  const roots = items.filter((i) => (parentId ? i.parentId === parentId : !i.parentId));
  const result: RoadmapItem[] = [];
  for (const root of roots) {
    result.push(root);
    result.push(...buildHierarchyTree(items, root.id));
  }
  return result;
}

export function getItemDepth(items: RoadmapItem[], itemId: string): number {
  let depth = 0;
  let current = items.find((i) => i.id === itemId);
  while (current?.parentId) {
    depth++;
    current = items.find((i) => i.id === current!.parentId);
  }
  return depth;
}

export type HierarchyLevel = 'Initiative' | 'Epic' | 'Task' | 'Subtask';

export function getHierarchyLabel(depth: number): HierarchyLevel {
  switch (depth) {
    case 0: return 'Initiative';
    case 1: return 'Epic';
    case 2: return 'Task';
    default: return 'Subtask';
  }
}

export function getHierarchyColor(depth: number): { bg: string; text: string; border: string } {
  switch (depth) {
    case 0: return { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' };
    case 1: return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' };
    case 2: return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' };
    default: return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' };
  }
}
