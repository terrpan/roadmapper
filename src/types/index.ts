export type ItemStatus = 'backlog' | 'planned' | 'in-progress' | 'done';

export type InitiativeSize = 'weeks' | 'months' | 'quarters' | 'years';

export interface DateRange {
  start: string; // ISO date string (YYYY-MM-DD)
  end: string;   // ISO date string (YYYY-MM-DD)
}

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
}

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: ItemStatus;
  size?: InitiativeSize;
  dateRange?: DateRange;
  parentId?: string;
  milestones: Milestone[];
  position: { x: number; y: number };
}

export type ConnectionType = 'direct' | 'indirect';

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  type?: ConnectionType;
}

export type ViewMode = 'canvas' | 'kanban' | 'gantt';

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
    return 'Both start and end dates fall outside the parent timeframe';
  }
  if (child.start < parent.start) {
    return `Start date is before parent start (${parent.start})`;
  }
  if (child.end > parent.end) {
    return `End date is after parent end (${parent.end})`;
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
