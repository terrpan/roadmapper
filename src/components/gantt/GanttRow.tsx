import { useMemo, useState, useCallback } from 'react';
import type { RoadmapItem, Connection } from '../../types';
import { computeEffectiveDateRange, getHierarchyLabel, getHierarchyColor, getDateRangeViolation, getItemChildren } from '../../types';

interface Props {
  item: RoadmapItem;
  allItems: RoadmapItem[];
  connections: Connection[];
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
  onDateRangeChange?: (id: string, dateRange: { start: string; end: string }) => void;
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

function xToDate(x: number, timelineStart: Date, scale: string, columnWidth: number): Date {
  let days: number;
  switch (scale) {
    case 'weeks':
      days = (x / columnWidth) * 7;
      break;
    case 'months':
      days = (x / columnWidth) * 30.44;
      break;
    case 'quarters':
      days = (x / columnWidth) * 91.31;
      break;
    default:
      days = 0;
  }
  return new Date(timelineStart.getTime() + days * 86400000);
}

/** Snap a date to the nearest scale unit boundary */
function snapDate(date: Date, scale: string): Date {
  const d = new Date(date);
  switch (scale) {
    case 'weeks': {
      // Snap to nearest Monday
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'months': {
      // Snap to nearest 1st of month
      if (d.getDate() > 15) {
        d.setMonth(d.getMonth() + 1, 1);
      } else {
        d.setDate(1);
      }
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'quarters': {
      // Snap to nearest quarter start
      const month = d.getMonth();
      const quarterStart = Math.floor(month / 3) * 3;
      const nextQuarter = quarterStart + 3;
      if (month - quarterStart < nextQuarter - month) {
        d.setMonth(quarterStart, 1);
      } else {
        d.setMonth(nextQuarter, 1);
      }
      d.setHours(0, 0, 0, 0);
      return d;
    }
  }
  return d;
}

const BAR_HEIGHT = 24;
const PARENT_BAR_HEIGHT = 10;

const depthColors = ['#e0e7ff', '#c7d2fe', '#a5b4fc']; // indigo-100, indigo-200, indigo-300

export default function GanttRow({
  item,
  allItems,
  connections,
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
  onDateRangeChange,
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

  // Resize drag state
  const [, setResizing] = useState<{ edge: 'left' | 'right'; startX: number; origRange: { start: string; end: string } } | null>(null);
  const [previewRange, setPreviewRange] = useState<{ start: string; end: string } | null>(null);

  const handleResizeStart = useCallback(
    (edge: 'left' | 'right', e: React.MouseEvent) => {
      if (!onDateRangeChange) return;
      // Use explicit dateRange if set, else fall back to computed effective range
      const rangeToUse = item.dateRange || effectiveRange;
      if (!rangeToUse) return;
      e.stopPropagation();
      e.preventDefault();
      const startX = e.clientX;
      const origRange = { start: rangeToUse.start, end: rangeToUse.end };
      setResizing({ edge, startX, origRange });

      // Compute children's min/max bounds to clamp parent resize
      const children = getItemChildren(allItems, item.id);
      let childMinStart: string | undefined;
      let childMaxEnd: string | undefined;
      for (const child of children) {
        const cr = computeEffectiveDateRange(child, allItems);
        if (!cr) continue;
        if (!childMinStart || cr.start < childMinStart) childMinStart = cr.start;
        if (!childMaxEnd || cr.end > childMaxEnd) childMaxEnd = cr.end;
      }

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const newDate = xToDate(
          dateToX(new Date(edge === 'left' ? origRange.start : origRange.end), timelineStart, scale, columnWidth) + dx,
          timelineStart,
          scale,
          columnWidth,
        );
        const snapped = snapDate(newDate, scale);
        let iso = snapped.toISOString().split('T')[0];

        if (edge === 'left') {
          // Clamp: parent start can't go past any child's start
          if (childMinStart && iso > childMinStart) iso = childMinStart;
          if (snapped < new Date(origRange.end)) {
            setPreviewRange({ start: iso, end: origRange.end });
          }
        } else {
          // Clamp: parent end can't go before any child's end
          if (childMaxEnd && iso < childMaxEnd) iso = childMaxEnd;
          if (snapped > new Date(origRange.start)) {
            setPreviewRange({ start: origRange.start, end: iso });
          }
        }
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        setResizing(null);
        setPreviewRange((prev) => {
          if (prev) {
            onDateRangeChange(item.id, prev);
          }
          return null;
        });
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [item.dateRange, item.id, effectiveRange, allItems, onDateRangeChange, timelineStart, scale, columnWidth],
  );

  // Compute bar from preview or effective range
  const displayRange = previewRange || effectiveRange;
  const displayBar = useMemo(() => {
    if (!displayRange) return null;
    const startDate = new Date(displayRange.start);
    const endDate = new Date(displayRange.end);
    const x = dateToX(startDate, timelineStart, scale, columnWidth);
    const xEnd = dateToX(endDate, timelineStart, scale, columnWidth);
    const width = Math.max(xEnd - x, 4);
    return { left: x, width };
  }, [displayRange, timelineStart, scale, columnWidth]);

  const activeBar = displayBar || barStyle;

  const rowHeight = hasChildren && depth === 0 ? 48 : 40;
  const timelineWidth = totalColumns * columnWidth;
  const isParent = hasChildren;
  const barH = isParent ? PARENT_BAR_HEIGHT : BAR_HEIGHT;
  const barTop = (rowHeight - barH) / 2;

  const parentItem = item.parentId ? allItems.find((i) => i.id === item.parentId) : null;
  const parentDateRange = parentItem
    ? (parentItem.dateRange ?? computeEffectiveDateRange(parentItem, allItems))
    : null;
  const violationMessage = item.dateRange && parentDateRange
    ? getDateRangeViolation(item.dateRange, parentDateRange)
    : null;
  const hasViolation = violationMessage !== null;

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

  // Dependency indicators
  const incomingBlocking = connections.filter(
    (c) => c.targetId === item.id && c.type === 'blocking'
  );
  const incomingDirect = connections.filter(
    (c) => c.targetId === item.id && (c.type ?? 'direct') === 'direct' && c.sourceId !== item.parentId
  );
  const outgoingBlocking = connections.filter(
    (c) => c.sourceId === item.id && c.type === 'blocking'
  );
  const hasBlockedBy = incomingBlocking.length > 0;
  const hasBlocks = outgoingBlocking.length > 0;
  const hasDependsOn = incomingDirect.length > 0;

  return (
    <div className="flex" style={{ height: rowHeight }}>
      {/* Left panel - item label */}
      <div
        className={`shrink-0 w-[250px] sticky left-0 z-[5] flex items-center border-r border-b px-2 cursor-pointer select-none ${
          hasViolation
            ? 'bg-red-50 border-red-200 hover:bg-red-100'
            : isSelected
              ? 'bg-blue-50 border-gray-200'
              : isRootParent
                ? 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                : 'bg-white hover:bg-gray-50 border-gray-200'
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
            <span className="relative shrink-0 ml-1 group/violation">
              <span className="flex items-center gap-0.5 text-[9px] font-medium text-red-600 bg-red-100 border border-red-300 px-1 py-0.5 rounded cursor-help">
                ⚠ Exceeds parent
              </span>
              <span className="absolute bottom-full left-0 mb-1.5 hidden group-hover/violation:block z-50 w-64 bg-gray-900 text-white text-xs rounded-md px-2.5 py-2 shadow-lg pointer-events-none">
                <span className="block font-semibold text-red-300 mb-0.5">Date range conflict</span>
                {violationMessage}
                <span className="absolute top-full left-3 -translate-x-0 border-4 border-transparent border-t-gray-900" />
              </span>
            </span>
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
          {hasBlockedBy && (
            <span className="relative shrink-0 ml-0.5 group/blocked">
              <span className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 cursor-help whitespace-nowrap">
                🚫 {incomingBlocking.length}
              </span>
              <span className="absolute bottom-full left-0 mb-1.5 hidden group-hover/blocked:block z-50 w-56 bg-gray-900 text-white text-xs rounded-md px-2.5 py-2 shadow-lg pointer-events-none">
                <span className="block font-semibold text-red-300 mb-1">Blocked by</span>
                {incomingBlocking.map((c) => {
                  const src = allItems.find((i) => i.id === c.sourceId);
                  return <span key={c.id} className="block truncate">• {src?.title ?? '?'}</span>;
                })}
                <span className="absolute top-full left-3 border-4 border-transparent border-t-gray-900" />
              </span>
            </span>
          )}
          {hasBlocks && (
            <span className="relative shrink-0 ml-0.5 group/blocks">
              <span className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200 cursor-help whitespace-nowrap">
                ⛔ {outgoingBlocking.length}
              </span>
              <span className="absolute bottom-full left-0 mb-1.5 hidden group-hover/blocks:block z-50 w-56 bg-gray-900 text-white text-xs rounded-md px-2.5 py-2 shadow-lg pointer-events-none">
                <span className="block font-semibold text-orange-300 mb-1">Blocks</span>
                {outgoingBlocking.map((c) => {
                  const tgt = allItems.find((i) => i.id === c.targetId);
                  return <span key={c.id} className="block truncate">• {tgt?.title ?? '?'}</span>;
                })}
                <span className="absolute top-full left-3 border-4 border-transparent border-t-gray-900" />
              </span>
            </span>
          )}
          {hasDependsOn && (
            <span className="relative shrink-0 ml-0.5 group/depends">
              <span className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-indigo-100 text-indigo-600 border border-indigo-200 cursor-help whitespace-nowrap">
                🔗 {incomingDirect.length}
              </span>
              <span className="absolute bottom-full left-0 mb-1.5 hidden group-hover/depends:block z-50 w-56 bg-gray-900 text-white text-xs rounded-md px-2.5 py-2 shadow-lg pointer-events-none">
                <span className="block font-semibold text-indigo-300 mb-1">Depends on</span>
                {incomingDirect.map((c) => {
                  const src = allItems.find((i) => i.id === c.sourceId);
                  return <span key={c.id} className="block truncate">• {src?.title ?? '?'}</span>;
                })}
                <span className="absolute top-full left-3 border-4 border-transparent border-t-gray-900" />
              </span>
            </span>
          )}
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
        {activeBar && (
          <div
            className={`absolute rounded group/bar ${hasViolation ? 'ring-2 ring-red-400 ring-offset-0' : ''}`}
            style={{
              left: activeBar.left,
              top: barTop,
              width: activeBar.width,
              height: barH,
              backgroundColor: BAR_BG_COLORS[item.status],
              opacity: isParent ? 0.7 : 1,
            }}
          >
            {/* Left resize handle */}
            {onDateRangeChange && (
              <div
                className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize opacity-0 group-hover/bar:opacity-100 hover:!opacity-100 z-10 rounded-l"
                style={{ backgroundColor: BAR_PROGRESS_COLORS[item.status] }}
                onMouseDown={(e) => handleResizeStart('left', e)}
              />
            )}

            {/* Right resize handle */}
            {onDateRangeChange && (
              <div
                className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize opacity-0 group-hover/bar:opacity-100 hover:!opacity-100 z-10 rounded-r"
                style={{ backgroundColor: BAR_PROGRESS_COLORS[item.status] }}
                onMouseDown={(e) => handleResizeStart('right', e)}
              />
            )}

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

            {/* Milestone diamonds */}
            {!isParent && item.milestones.length > 0 && (
              <>
                {item.milestones.map((ms, i) => {
                  // Evenly space milestones along the bar
                  const frac = item.milestones.length === 1 ? 0.5 : i / (item.milestones.length - 1);
                  const xPos = frac * activeBar.width;
                  return (
                    <div
                      key={ms.id}
                      className="absolute"
                      title={ms.title}
                      style={{
                        left: xPos - 5,
                        top: -3,
                        width: 10,
                        height: 10,
                        transform: 'rotate(45deg)',
                        backgroundColor: ms.completed ? BAR_PROGRESS_COLORS[item.status] : 'transparent',
                        border: `2px solid ${BAR_PROGRESS_COLORS[item.status]}`,
                        zIndex: 5,
                      }}
                    />
                  );
                })}
              </>
            )}

            {/* Title text inside bar */}
            {!isParent && activeBar.width > 60 && (
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
