import React, { useMemo, useState } from 'react';
import { useRoadmapStore } from '../../store/roadmapStore';
import {
  buildHierarchyTree,
  computeEffectiveDateRange,
  getItemChildren,
  getItemDepth,
} from '../../types';
import type { RoadmapItem } from '../../types';
import GanttTimeline, { getColumns } from './GanttTimeline';
import GanttRow from './GanttRow';
import GanttDependencies from './GanttDependencies';

const ROW_HEIGHT = 40;

const COLUMN_WIDTHS: Record<string, number> = {
  weeks: 40,
  months: 80,
  quarters: 100,
};

function detectScale(start: Date, end: Date): 'weeks' | 'months' | 'quarters' {
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

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const orderedItems = useMemo(() => buildHierarchyTree(scopedItems), [scopedItems]);

  const timelineRange = useMemo(
    () => getTimelineRange(orderedItems, scopedItems),
    [orderedItems, scopedItems],
  );

  const scale = useMemo(() => {
    if (!timelineRange) return 'months' as const;
    return detectScale(timelineRange.start, timelineRange.end);
  }, [timelineRange]);

  const columnWidth = COLUMN_WIDTHS[scale];

  const columns = useMemo(() => {
    if (!timelineRange) return [];
    return getColumns(timelineRange.start, timelineRange.end, scale);
  }, [timelineRange, scale]);

  const visibleItems = useMemo(
    () => orderedItems.filter((item) => !isAncestorCollapsed(item, scopedItems, collapsed)),
    [orderedItems, scopedItems, collapsed],
  );

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!timelineRange) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Add date ranges to your items to see them on the Gantt chart
      </div>
    );
  }

  const totalColumns = columns.length;
  const timelineWidth = totalColumns * columnWidth;

  return (
    <div className="flex-1 overflow-auto">
      <div style={{ minWidth: 250 + timelineWidth }}>
        {/* Header */}
        <div className="flex sticky top-0 z-10">
          <div className="shrink-0 w-[250px] sticky left-0 z-20 bg-white border-r border-b border-gray-200 flex items-end px-3 pb-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Items
            </span>
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
            const depth = getItemDepth(scopedItems, item.id);
            const hasChildren = getItemChildren(scopedItems, item.id).length > 0;
            const isNewGroup = depth === 0 && idx > 0;

            return (
              <React.Fragment key={item.id}>
                {isNewGroup && <div className="h-px bg-gray-200 mx-2 my-0.5" />}
                <GanttRow
                  item={item}
                  allItems={scopedItems}
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
                />
              </React.Fragment>
            );
          })}

          {/* Dependency arrows overlay */}
          <div className="absolute top-0 left-[250px]">
            <GanttDependencies
              connections={connections}
              visibleItems={visibleItems}
              allItems={scopedItems}
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
