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
  type?: 'direct' | 'indirect';
}

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

      // Smooth cubic bezier connector path
      const dx = tgtStartX - srcEndX;
      const d = `M ${srcEndX} ${srcY} C ${srcEndX + dx * 0.4} ${srcY}, ${tgtStartX - dx * 0.4} ${tgtY}, ${tgtStartX} ${tgtY}`;

      result.push({ id: conn.id, d, type: (conn as Connection & { type?: 'direct' | 'indirect' }).type });
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
      style={{ zIndex: 2 }}
    >
      <defs>
        <marker
          id="gantt-arrowhead"
          markerWidth="6"
          markerHeight="5"
          refX="6"
          refY="2.5"
          orient="auto"
        >
          <polygon points="0 0, 6 2.5, 0 5" fill="#94a3b8" />
        </marker>
      </defs>
      {arrows.map((arrow) => (
        <path
          key={arrow.id}
          d={arrow.d}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1.5"
          opacity="0.7"
          markerEnd="url(#gantt-arrowhead)"
          {...(arrow.type === 'indirect' ? { strokeDasharray: '4 3' } : {})}
        />
      ))}
    </svg>
  );
}
