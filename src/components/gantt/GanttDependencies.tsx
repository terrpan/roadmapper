import { useMemo } from 'react';
import type { Connection, RoadmapItem } from '../../types';
import { computeEffectiveDateRange } from '../../types';
import { dateToX } from './GanttRow';

interface Props {
  connections: Connection[];
  visibleItems: RoadmapItem[];
  allItems: RoadmapItem[];
  timelineStart: Date;
  columnWidth: number;
  scale: 'weeks' | 'months' | 'quarters';
  totalColumns: number;
  rowHeight: number;
}

interface ArrowPath {
  id: string;
  d: string;
  type: 'direct' | 'indirect' | 'blocking';
  labelX: number;
  labelY: number;
}

/** Check if a connection represents a parent-child hierarchy link */
function isHierarchyConnection(conn: Connection, allItems: RoadmapItem[]): boolean {
  const target = allItems.find((i) => i.id === conn.targetId);
  if (target?.parentId === conn.sourceId) return true;
  const source = allItems.find((i) => i.id === conn.sourceId);
  if (source?.parentId === conn.targetId) return true;
  return false;
}

const COLORS = {
  direct: '#6366f1',   // indigo
  indirect: '#94a3b8', // gray
  blocking: '#ef4444', // red
};

export default function GanttDependencies({
  connections,
  visibleItems,
  allItems,
  timelineStart,
  columnWidth,
  scale,
  totalColumns,
  rowHeight,
}: Props) {
  const arrows = useMemo(() => {
    const indexMap = new Map<string, number>();
    visibleItems.forEach((item, i) => indexMap.set(item.id, i));

    const result: ArrowPath[] = [];

    for (const conn of connections) {
      if (isHierarchyConnection(conn, allItems)) continue;

      const connType = conn.type ?? 'direct';
      // Only show direct and blocking in Gantt
      if (connType === 'indirect') continue;

      const srcIdx = indexMap.get(conn.sourceId);
      const tgtIdx = indexMap.get(conn.targetId);
      if (srcIdx === undefined || tgtIdx === undefined) continue;

      const srcItem = visibleItems[srcIdx];
      const tgtItem = visibleItems[tgtIdx];

      const srcRange = computeEffectiveDateRange(srcItem, allItems);
      const tgtRange = computeEffectiveDateRange(tgtItem, allItems);
      if (!srcRange || !tgtRange) continue;

      const srcEndX = dateToX(new Date(srcRange.end), timelineStart, scale, columnWidth);
      const tgtStartX = dateToX(new Date(tgtRange.start), timelineStart, scale, columnWidth);

      const srcY = srcIdx * rowHeight + rowHeight / 2;
      const tgtY = tgtIdx * rowHeight + rowHeight / 2;

      // Elbow-style stepped path (standard for Gantt charts)
      const gap = 12;
      const midX = Math.max(srcEndX + gap, (srcEndX + tgtStartX) / 2);
      let d: string;

      if (tgtStartX > srcEndX + gap * 2) {
        // Normal case: target starts after source ends — simple elbow
        d = `M ${srcEndX} ${srcY} H ${midX} V ${tgtY} H ${tgtStartX}`;
      } else {
        // Overlap: target starts before/at source end — route around
        const detourY = srcY < tgtY
          ? Math.max(srcY, tgtY) + rowHeight * 0.4
          : Math.min(srcY, tgtY) - rowHeight * 0.4;
        d = `M ${srcEndX} ${srcY} H ${srcEndX + gap} V ${detourY} H ${tgtStartX - gap} V ${tgtY} H ${tgtStartX}`;
      }

      // Label at the midpoint of the path
      const labelX = (srcEndX + tgtStartX) / 2;
      const labelY = srcY === tgtY ? srcY - 10 : (srcY + tgtY) / 2;

      result.push({ id: conn.id, d, type: connType, labelX, labelY });
    }

    return result;
  }, [connections, visibleItems, allItems, timelineStart, columnWidth, scale, rowHeight]);

  const svgWidth = totalColumns * columnWidth;
  const svgHeight = visibleItems.length * rowHeight;

  if (arrows.length === 0) return null;

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      width={svgWidth}
      height={svgHeight}
      style={{ zIndex: 5 }}
    >
      <defs>
        <marker id="gantt-arrow-direct" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={COLORS.direct} />
        </marker>
        <marker id="gantt-arrow-blocking" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={COLORS.blocking} />
        </marker>
        <filter id="gantt-dep-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.1" />
        </filter>
      </defs>
      {arrows.map((arrow) => {
        const color = COLORS[arrow.type];
        const isBlocking = arrow.type === 'blocking';
        return (
          <g key={arrow.id}>
            <path
              d={arrow.d}
              fill="none"
              stroke={color}
              strokeWidth={isBlocking ? 2.5 : 2}
              opacity="0.85"
              strokeLinejoin="round"
              markerEnd={`url(#gantt-arrow-${arrow.type})`}
              filter="url(#gantt-dep-shadow)"
            />
            {/* Small dot at source end */}
            <circle
              cx={arrow.d.split(' ')[1]}
              cy={arrow.d.split(' ')[2]}
              r={3}
              fill={color}
              opacity="0.85"
            />
            {/* Label for blocking connections */}
            {isBlocking && (
              <>
                <rect
                  x={arrow.labelX - 24}
                  y={arrow.labelY - 9}
                  width={48}
                  height={18}
                  rx={4}
                  fill="#fef2f2"
                  stroke="#fecaca"
                  strokeWidth={1}
                />
                <text
                  x={arrow.labelX}
                  y={arrow.labelY + 4}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill="#dc2626"
                >
                  blocks
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
