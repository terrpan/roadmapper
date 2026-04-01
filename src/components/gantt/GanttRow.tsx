import { useMemo } from 'react';
import type { RoadmapItem } from '../../types';
import { computeEffectiveDateRange, getHierarchyLabel, getHierarchyColor, getDateRangeViolation, getItemChildren } from '../../types';

interface Props {
  item: RoadmapItem;
  allItems: RoadmapItem[];
  depth: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  onToggleCollapse: (id: string) => void;
  isSelected: boolean;
  onSelect: (id: string) => void;
  timelineStart: Date;
  columnWidth: number;
  scale: 'weeks' | 'months' | 'quarters';
  totalColumns: number;
}

const STATUS_DOT_COLORS: Record<string, string> = {
  backlog: 'bg-gray-400',
  planned: 'bg-blue-400',
  'in-progress': 'bg-amber-400',
  done: 'bg-green-400',
};

const BAR_BG_COLORS: Record<string, string> = {
  backlog: '#d1d5db',
  planned: '#60a5fa',
  'in-progress': '#fbbf24',
  done: '#4ade80',
};

const BAR_PROGRESS_COLORS: Record<string, string> = {
  backlog: '#9ca3af',
  planned: '#3b82f6',
  'in-progress': '#f59e0b',
  done: '#22c55e',
};

function dateToX(date: Date, timelineStart: Date, scale: string, columnWidth: number): number {
  const msPerDay = 86400000;
  const days = (date.getTime() - timelineStart.getTime()) / msPerDay;
  switch (scale) {
    case 'weeks':
      return (days / 7) * columnWidth;
    case 'months':
      return (days / 30.44) * columnWidth;
    case 'quarters':
      return (days / 91.31) * columnWidth;
  }
  return 0;
}

const BAR_HEIGHT = 24;
const PARENT_BAR_HEIGHT = 10;

const depthColors = ['#e0e7ff', '#c7d2fe', '#a5b4fc']; // indigo-100, indigo-200, indigo-300

export default function GanttRow({
  item,
  allItems,
  depth,
  hasChildren,
  isCollapsed,
  onToggleCollapse,
  isSelected,
  onSelect,
  timelineStart,
  columnWidth,
  scale,
  totalColumns,
}: Props) {
  const effectiveRange = useMemo(
    () => computeEffectiveDateRange(item, allItems),
    [item, allItems],
  );

  const milestoneProgress = useMemo(() => {
    if (item.milestones.length === 0) return 0;
    const completed = item.milestones.filter((m) => m.completed).length;
    return completed / item.milestones.length;
  }, [item.milestones]);

  const barStyle = useMemo(() => {
    if (!effectiveRange) return null;
    const startDate = new Date(effectiveRange.start);
    const endDate = new Date(effectiveRange.end);
    const x = dateToX(startDate, timelineStart, scale, columnWidth);
    const xEnd = dateToX(endDate, timelineStart, scale, columnWidth);
    const width = Math.max(xEnd - x, 4);
    return { left: x, width };
  }, [effectiveRange, timelineStart, scale, columnWidth]);

  const rowHeight = hasChildren && depth === 0 ? 48 : 40;
  const timelineWidth = totalColumns * columnWidth;
  const isParent = hasChildren;
  const barH = isParent ? PARENT_BAR_HEIGHT : BAR_HEIGHT;
  const barTop = (rowHeight - barH) / 2;

  const parentItem = item.parentId ? allItems.find((i) => i.id === item.parentId) : null;
  const parentDateRange = parentItem?.dateRange ?? (parentItem ? computeEffectiveDateRange(parentItem, getItemChildren(allItems, parentItem.id)) : null);
  const hasViolation = item.dateRange && parentDateRange ? getDateRangeViolation(item.dateRange, parentDateRange) !== null : false;

  const isRootParent = hasChildren && depth === 0;
  const isNestedParent = hasChildren && depth > 0;

  const titleClass = isRootParent
    ? 'text-sm truncate font-semibold text-gray-800'
    : isNestedParent
      ? 'text-sm truncate font-medium text-gray-700'
      : 'text-sm truncate text-gray-700';

  const dotClass = isRootParent
    ? `w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT_COLORS[item.status]}`
    : `w-2 h-2 rounded-full shrink-0 ${STATUS_DOT_COLORS[item.status]}`;

  const leftPanelDepthStyle =
    depth > 0
      ? { borderLeft: `2px solid ${depthColors[Math.min(depth - 1, 2)]}` }
      : undefined;

  return (
    <div className="flex" style={{ height: rowHeight }}>
      {/* Left panel - item label */}
      <div
        className={`shrink-0 w-[250px] sticky left-0 z-[5] flex items-center border-r border-b border-gray-200 px-2 cursor-pointer select-none ${
          isSelected ? 'bg-blue-50' : isRootParent ? 'bg-gray-50 hover:bg-gray-100' : 'bg-white hover:bg-gray-50'
        }`}
        style={leftPanelDepthStyle}
        onClick={() => onSelect(item.id)}
      >
        <div style={{ paddingLeft: depth * 20 }} className="flex items-center gap-1.5 min-w-0">
          {hasChildren ? (
            <button
              className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse(item.id);
              }}
            >
              {isCollapsed ? '▸' : '▾'}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <span className={dotClass} />
          <span className={titleClass}>{item.title}</span>
          {hasViolation && (
            <span className="text-red-500 text-xs ml-1" title="Date range exceeds parent timeframe">⚠️</span>
          )}
          {(() => {
            const label = getHierarchyLabel(depth);
            const hColors = getHierarchyColor(depth);
            return (
              <span className={`text-[9px] px-1 py-0.5 rounded ${hColors.bg} ${hColors.text} ml-1 whitespace-nowrap`}>
                {label}
              </span>
            );
          })()}
        </div>
      </div>

      {/* Right panel - timeline bar */}
      <div
        className={`relative border-b border-gray-100 ${isRootParent ? 'bg-gray-50/80' : 'bg-gray-50/50'}`}
        style={{ width: timelineWidth, minWidth: timelineWidth }}
      >
        {/* Grid lines */}
        {Array.from({ length: totalColumns }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 border-r border-gray-100"
            style={{ left: i * columnWidth, width: columnWidth }}
          />
        ))}

        {/* Bar */}
        {barStyle && (
          <div
            className="absolute rounded"
            style={{
              left: barStyle.left,
              top: barTop,
              width: barStyle.width,
              height: barH,
              backgroundColor: BAR_BG_COLORS[item.status],
              opacity: isParent ? 0.7 : 1,
            }}
          >
            {/* Milestone progress fill */}
            {milestoneProgress > 0 && !isParent && (
              <div
                className="absolute inset-y-0 left-0 rounded"
                style={{
                  width: `${milestoneProgress * 100}%`,
                  backgroundColor: BAR_PROGRESS_COLORS[item.status],
                  opacity: 0.5,
                }}
              />
            )}

            {/* Parent bracket ends */}
            {isParent && (
              <>
                <div
                  className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l"
                  style={{ backgroundColor: BAR_PROGRESS_COLORS[item.status] }}
                />
                <div
                  className="absolute right-0 top-0 bottom-0 w-[3px] rounded-r"
                  style={{ backgroundColor: BAR_PROGRESS_COLORS[item.status] }}
                />
              </>
            )}

            {/* Title text inside bar */}
            {!isParent && barStyle.width > 60 && (
              <span className="absolute inset-0 flex items-center px-1.5 text-[10px] text-white font-medium truncate drop-shadow-sm">
                {item.title}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { dateToX };
