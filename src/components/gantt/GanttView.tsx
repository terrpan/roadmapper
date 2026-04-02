import React, { useMemo, useState, useCallback } from 'react';
import { useRoadmapStore } from '../../store/roadmapStore';
import {
  buildHierarchyTree,
  computeEffectiveDateRange,
  getItemChildren,
  getItemDepth,
} from '../../types';
import type { RoadmapItem } from '../../types';
import GanttTimeline, { getColumns } from './GanttTimeline';
import GanttRow, { dateToX } from './GanttRow';
import GanttDependencies from './GanttDependencies';

const ROW_HEIGHT = 40;

const COLUMN_WIDTHS: Record<string, number> = {
  weeks: 40,
  months: 80,
  quarters: 100,
};

type ScaleOption = 'weeks' | 'months' | 'quarters';

function detectScale(start: Date, end: Date): ScaleOption {
  const msPerDay = 86400000;
  const days = (end.getTime() - start.getTime()) / msPerDay;
  if (days < 90) return 'weeks';
  if (days < 730) return 'months';
  return 'quarters';
}

function getTimelineRange(
  items: RoadmapItem[],
  allItems: RoadmapItem[],
): { start: Date; end: Date } | null {
  let minStart: string | undefined;
  let maxEnd: string | undefined;

  for (const item of items) {
    const range = computeEffectiveDateRange(item, allItems);
    if (!range) continue;
    if (!minStart || range.start < minStart) minStart = range.start;
    if (!maxEnd || range.end > maxEnd) maxEnd = range.end;
  }

  if (!minStart || !maxEnd) return null;

  // Add padding: 1 unit before and after
  const start = new Date(minStart);
  const end = new Date(maxEnd);
  start.setDate(start.getDate() - 14);
  end.setDate(end.getDate() + 14);

  return { start, end };
}

function isAncestorCollapsed(
  item: RoadmapItem,
  allItems: RoadmapItem[],
  collapsed: Set<string>,
): boolean {
  let current = allItems.find((i) => i.id === item.parentId);
  while (current) {
    if (collapsed.has(current.id)) return true;
    current = allItems.find((i) => i.id === current!.parentId);
  }
  return false;
}

export default function GanttView() {
  const items = useRoadmapStore((s) => s.items);
  const connections = useRoadmapStore((s) => s.connections);
  const selectedItemId = useRoadmapStore((s) => s.selectedItemId);
  const selectItem = useRoadmapStore((s) => s.selectItem);
  const scopeItemId = useRoadmapStore((s) => s.scopeItemId);
  const updateItem = useRoadmapStore((s) => s.updateItem);

  const searchQuery = useRoadmapStore((s) => s.searchQuery);

  const [scaleOverride, setScaleOverride] = useState<ScaleOption | 'auto'>('auto');

  const scopedItems = useMemo(() => {
    if (scopeItemId === null) {
      return items;
    }
    // Show the scoped item and all its descendants
    const ids = new Set<string>();
    const queue = [scopeItemId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      ids.add(current);
      for (const item of items) {
        if (item.parentId === current && !ids.has(item.id)) {
          ids.add(item.id);
          queue.push(item.id);
        }
      }
    }
    return items.filter((i) => ids.has(i.id));
  }, [items, scopeItemId]);

  const searchFilteredItems = useMemo(() => {
    if (!searchQuery) return scopedItems;
    const q = searchQuery.toLowerCase();
    return scopedItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
    );
  }, [scopedItems, searchQuery]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const orderedItems = useMemo(() => buildHierarchyTree(searchFilteredItems), [searchFilteredItems]);

  const timelineRange = useMemo(
    () => getTimelineRange(orderedItems, searchFilteredItems),
    [orderedItems, searchFilteredItems],
  );

  const scale = useMemo(() => {
    if (scaleOverride !== 'auto') return scaleOverride;
    if (!timelineRange) return 'months' as const;
    return detectScale(timelineRange.start, timelineRange.end);
  }, [timelineRange, scaleOverride]);

  const columnWidth = COLUMN_WIDTHS[scale];

  const columns = useMemo(() => {
    if (!timelineRange) return [];
    return getColumns(timelineRange.start, timelineRange.end, scale);
  }, [timelineRange, scale]);

  const visibleItems = useMemo(
    () => orderedItems.filter((item) => !isAncestorCollapsed(item, searchFilteredItems, collapsed)),
    [orderedItems, searchFilteredItems, collapsed],
  );

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDateRangeChange = useCallback(
    (id: string, dateRange: { start: string; end: string }) => {
      updateItem(id, { dateRange });
    },
    [updateItem],
  );

  if (!timelineRange) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Add date ranges to your items to see them on the Gantt chart
      </div>
    );
  }

  const totalColumns = columns.length;
  const timelineWidth = totalColumns * columnWidth;

  // Today line position
  const today = new Date();
  const todayX = dateToX(today, timelineRange.start, scale, columnWidth);
  const showTodayLine = todayX >= 0 && todayX <= timelineWidth;

  // Tree connector data: for each visible parent, find vertical spans to children
  const treeConnectors: { parentIdx: number; childIndices: number[]; depth: number; parentBarLeft: number }[] = [];
  const visibleIndexMap = new Map<string, number>();
  visibleItems.forEach((item, i) => visibleIndexMap.set(item.id, i));
  for (let i = 0; i < visibleItems.length; i++) {
    const item = visibleItems[i];
    const children = getItemChildren(searchFilteredItems, item.id);
    const visibleChildIndices = children
      .map((c) => visibleIndexMap.get(c.id))
      .filter((idx): idx is number => idx !== undefined);
    if (visibleChildIndices.length > 0) {
      const range = computeEffectiveDateRange(item, searchFilteredItems);
      const barLeft = range ? dateToX(new Date(range.start), timelineRange.start, scale, columnWidth) : 0;
      treeConnectors.push({
        parentIdx: i,
        childIndices: visibleChildIndices,
        depth: getItemDepth(searchFilteredItems, item.id),
        parentBarLeft: barLeft,
      });
    }
  }

  const SCALE_OPTIONS: { value: ScaleOption | 'auto'; label: string }[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'weeks', label: 'Weeks' },
    { value: 'months', label: 'Months' },
    { value: 'quarters', label: 'Quarters' },
  ];

  return (
    <div className="flex-1 overflow-auto">
      <div style={{ minWidth: 250 + timelineWidth }}>
        {/* Header */}
        <div className="flex sticky top-0 z-10">
          <div className="shrink-0 w-[250px] sticky left-0 z-20 bg-white border-r border-b border-gray-200 flex items-end justify-between px-3 pb-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Items
            </span>
            {/* Scale toggle */}
            <div className="flex gap-0.5 bg-gray-100 rounded p-0.5">
              {SCALE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setScaleOverride(opt.value)}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                    (scaleOverride === opt.value || (scaleOverride === 'auto' && opt.value === 'auto'))
                      ? 'bg-white text-gray-800 shadow-sm font-medium'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ width: timelineWidth, minWidth: timelineWidth }}>
            <GanttTimeline
              timelineStart={timelineRange.start}
              timelineEnd={timelineRange.end}
              scale={scale}
              columnWidth={columnWidth}
            />
          </div>
        </div>

        {/* Rows */}
        <div className="relative">
          {visibleItems.map((item, idx) => {
            const depth = getItemDepth(searchFilteredItems, item.id);
            const hasChildren = getItemChildren(searchFilteredItems, item.id).length > 0;
            const isNewGroup = depth === 0 && idx > 0;

            return (
              <React.Fragment key={item.id}>
                {isNewGroup && <div className="h-px bg-gray-200 mx-2 my-0.5" />}
                <GanttRow
                  item={item}
                  allItems={searchFilteredItems}
                  connections={connections}
                  depth={depth}
                  hasChildren={hasChildren}
                  isCollapsed={collapsed.has(item.id)}
                  onToggleCollapse={toggleCollapse}
                  isSelected={selectedItemId === item.id}
                  onSelect={selectItem}
                  timelineStart={timelineRange.start}
                  columnWidth={columnWidth}
                  scale={scale}
                  totalColumns={totalColumns}
                  onDateRangeChange={handleDateRangeChange}
                />
              </React.Fragment>
            );
          })}

          {/* Tree connector lines overlay */}
          <div className="absolute top-0 left-[250px] pointer-events-none" style={{ zIndex: 1 }}>
            <svg width={timelineWidth} height={visibleItems.length * ROW_HEIGHT}>
              {treeConnectors.map((tc) => {
                const connectorX = Math.max(tc.parentBarLeft - 8, 4);
                const parentY = tc.parentIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                const colors = ['#a5b4fc', '#93c5fd', '#86efac', '#d1d5db'];
                const color = colors[Math.min(tc.depth, colors.length - 1)];

                return tc.childIndices.map((childIdx) => {
                  const childY = childIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                  return (
                    <path
                      key={`tree-${tc.parentIdx}-${childIdx}`}
                      d={`M ${connectorX} ${parentY} L ${connectorX} ${childY} L ${connectorX + 10} ${childY}`}
                      fill="none"
                      stroke={color}
                      strokeWidth="1.5"
                      opacity="0.6"
                    />
                  );
                });
              })}
            </svg>
          </div>

          {/* Today line */}
          {showTodayLine && (
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{ left: 250 + todayX, zIndex: 3 }}
            >
              <div className="absolute -top-0.5 -left-[18px] bg-red-500 text-white text-[9px] font-medium px-1 py-0.5 rounded">
                Today
              </div>
              <div
                className="w-px h-full"
                style={{
                  borderLeft: '1.5px dashed #ef4444',
                }}
              />
            </div>
          )}

          {/* Dependency arrows overlay */}
          <div className="absolute top-0 left-[250px]">
            <GanttDependencies
              connections={connections}
              visibleItems={visibleItems}
              allItems={searchFilteredItems}
              timelineStart={timelineRange.start}
              columnWidth={columnWidth}
              scale={scale}
              totalColumns={totalColumns}
              rowHeight={ROW_HEIGHT}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
