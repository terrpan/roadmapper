import { useMemo } from 'react';

interface Props {
  timelineStart: Date;
  timelineEnd: Date;
  scale: 'weeks' | 'months' | 'quarters';
  columnWidth: number;
}

interface Column {
  label: string;
  group?: string;
}

function getColumns(start: Date, end: Date, scale: 'weeks' | 'months' | 'quarters'): Column[] {
  const cols: Column[] = [];

  if (scale === 'weeks') {
    const current = new Date(start);
    // Align to Monday
    const day = current.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    current.setDate(current.getDate() + diff);

    let weekNum = 1;
    while (current <= end) {
      const month = current.toLocaleString('en', { month: 'short' });
      const year = current.getFullYear();
      cols.push({ label: `W${weekNum}`, group: `${month} ${year}` });
      current.setDate(current.getDate() + 7);
      weekNum++;
    }
  } else if (scale === 'months') {
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      const month = current.toLocaleString('en', { month: 'short' });
      cols.push({ label: month, group: `${current.getFullYear()}` });
      current.setMonth(current.getMonth() + 1);
    }
  } else {
    const current = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);
    while (current <= end) {
      const q = Math.floor(current.getMonth() / 3) + 1;
      cols.push({ label: `Q${q}`, group: `${current.getFullYear()}` });
      current.setMonth(current.getMonth() + 3);
    }
  }

  return cols;
}

export default function GanttTimeline({ timelineStart, timelineEnd, scale, columnWidth }: Props) {
  const columns = useMemo(
    () => getColumns(timelineStart, timelineEnd, scale),
    [timelineStart, timelineEnd, scale],
  );

  // Group consecutive columns by their group label
  const groups = useMemo(() => {
    const result: { label: string; span: number }[] = [];
    for (const col of columns) {
      const grp = col.group ?? '';
      if (result.length > 0 && result[result.length - 1].label === grp) {
        result[result.length - 1].span++;
      } else {
        result.push({ label: grp, span: 1 });
      }
    }
    return result;
  }, [columns]);

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
      {/* Group row */}
      <div className="flex h-6 text-[10px] text-gray-500 font-medium">
        {groups.map((g, i) => (
          <div
            key={`${g.label}-${i}`}
            className="border-r border-gray-200 flex items-center justify-center truncate"
            style={{ width: g.span * columnWidth, minWidth: g.span * columnWidth }}
          >
            {g.label}
          </div>
        ))}
      </div>
      {/* Column labels row */}
      <div className="flex h-6 text-[11px] text-gray-600 font-medium">
        {columns.map((col, i) => (
          <div
            key={`${col.label}-${i}`}
            className="border-r border-gray-200 flex items-center justify-center truncate"
            style={{ width: columnWidth, minWidth: columnWidth }}
          >
            {col.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export { getColumns };
export type { Column };
