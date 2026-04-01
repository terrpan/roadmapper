import { useState, useEffect } from 'react';
import { useRoadmapStore } from '../../store/roadmapStore';
import type { ItemStatus, InitiativeSize, DateRange } from '../../types';
import { getDescendantIds, getItemDepth, getHierarchyLabel, getDateRangeViolation, computeEffectiveDateRange, getItemChildren, formatDateRange } from '../../types';

const STATUSES: { value: ItemStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'planned', label: 'Planned' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

const SIZES: { value: InitiativeSize; label: string }[] = [
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
  { value: 'quarters', label: 'Quarters' },
  { value: 'years', label: 'Years' },
];

const QUARTERS = [
  { value: '1', label: 'Q1 (Jan–Mar)' },
  { value: '2', label: 'Q2 (Apr–Jun)' },
  { value: '3', label: 'Q3 (Jul–Sep)' },
  { value: '4', label: 'Q4 (Oct–Dec)' },
];

function lastDayOfMonth(year: number, month: number): string {
  // month is 1-based; Date with day=0 gives last day of previous month
  const d = new Date(year, month, 0);
  return d.toISOString().slice(0, 10);
}

function quarterStartMonth(q: number): number {
  return (q - 1) * 3; // 0-based month
}

function buildDateRange(
  size: InitiativeSize | '',
  startDate: string,
  endDate: string,
  startYear: string,
  startQuarter: string,
  endYear: string,
  endQuarter: string,
): DateRange | undefined {
  switch (size) {
    case 'weeks': {
      if (!startDate || !endDate) return undefined;
      // HTML week input: "2026-W14" → Monday of that ISO week
      const toISO = (weekVal: string) => {
        const [y, w] = weekVal.split('-W').map(Number);
        // Jan 4 is always in ISO week 1
        const jan4 = new Date(Date.UTC(y, 0, 4));
        const dayOfWeek = jan4.getUTCDay() || 7;
        const monday = new Date(jan4.getTime() + ((w - 1) * 7 + 1 - dayOfWeek) * 86400000);
        return monday.toISOString().slice(0, 10);
      };
      const startISO = toISO(startDate);
      // End date = Sunday of the end week (Monday + 6 days)
      const endMonday = new Date(toISO(endDate));
      endMonday.setUTCDate(endMonday.getUTCDate() + 6);
      return { start: startISO, end: endMonday.toISOString().slice(0, 10) };
    }
    case 'months': {
      if (!startDate || !endDate) return undefined;
      // HTML month input: "2026-04"
      const [sy, sm] = startDate.split('-').map(Number);
      const [ey, em] = endDate.split('-').map(Number);
      return {
        start: `${sy}-${String(sm).padStart(2, '0')}-01`,
        end: lastDayOfMonth(ey, em),
      };
    }
    case 'quarters': {
      const sy = parseInt(startYear, 10);
      const sq = parseInt(startQuarter, 10);
      const ey = parseInt(endYear, 10);
      const eq = parseInt(endQuarter, 10);
      if (isNaN(sy) || isNaN(sq) || isNaN(ey) || isNaN(eq)) return undefined;
      const startMonth = quarterStartMonth(sq);
      const endMonth = quarterStartMonth(eq) + 2; // last month of quarter (0-based)
      return {
        start: `${sy}-${String(startMonth + 1).padStart(2, '0')}-01`,
        end: lastDayOfMonth(ey, endMonth + 1), // +1 because lastDayOfMonth expects 1-based
      };
    }
    case 'years': {
      const sy = parseInt(startDate, 10);
      const ey = parseInt(endDate, 10);
      if (isNaN(sy) || isNaN(ey)) return undefined;
      return { start: `${sy}-01-01`, end: `${ey}-12-31` };
    }
    default:
      return undefined;
  }
}

// Reverse: given a DateRange and size, extract form values for editing
function extractDateFields(size: InitiativeSize, range: DateRange) {
  const start = new Date(range.start);
  const end = new Date(range.end);

  switch (size) {
    case 'weeks': {
      const toWeekVal = (d: Date) => {
        const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayOfWeek = tmp.getUTCDay() || 7;
        tmp.setUTCDate(tmp.getUTCDate() + 4 - dayOfWeek);
        const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
        return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
      };
      return { startDate: toWeekVal(start), endDate: toWeekVal(end) };
    }
    case 'months':
      return {
        startDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
        endDate: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`,
      };
    case 'quarters':
      return {
        startYear: String(start.getFullYear()),
        startQuarter: String(Math.floor(start.getMonth() / 3) + 1),
        endYear: String(end.getFullYear()),
        endQuarter: String(Math.floor(end.getMonth() / 3) + 1),
      };
    case 'years':
      return {
        startDate: String(start.getFullYear()),
        endDate: String(end.getFullYear()),
      };
  }
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

export function ItemDialog() {
  const dialogOpen = useRoadmapStore((s) => s.dialogOpen);
  const editingItemId = useRoadmapStore((s) => s.editingItemId);
  const items = useRoadmapStore((s) => s.items);
  const addItem = useRoadmapStore((s) => s.addItem);
  const updateItem = useRoadmapStore((s) => s.updateItem);
  const closeDialog = useRoadmapStore((s) => s.closeDialog);
  const scopeItemId = useRoadmapStore((s) => s.scopeItemId);

  const editingItem = editingItemId ? items.find((i) => i.id === editingItemId) : null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ItemStatus>('backlog');
  const [size, setSize] = useState<InitiativeSize | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [startYear, setStartYear] = useState(String(new Date().getFullYear()));
  const [startQuarter, setStartQuarter] = useState('1');
  const [endYear, setEndYear] = useState(String(new Date().getFullYear()));
  const [endQuarter, setEndQuarter] = useState('1');
  const [dateWarning, setDateWarning] = useState<string | null>(null);

  const resetDateFields = () => {
    setStartDate('');
    setEndDate('');
    setStartYear(String(new Date().getFullYear()));
    setStartQuarter('1');
    setEndYear(String(new Date().getFullYear()));
    setEndQuarter('1');
  };

  useEffect(() => {
    if (editingItem) {
      setTitle(editingItem.title);
      setDescription(editingItem.description);
      setStatus(editingItem.status);
      setSize(editingItem.size ?? '');
      setParentId(editingItem.parentId ?? '');
      resetDateFields();
      if (editingItem.size && editingItem.dateRange) {
        const fields = extractDateFields(editingItem.size, editingItem.dateRange);
        if ('startDate' in fields && fields.startDate) setStartDate(fields.startDate);
        if ('endDate' in fields && fields.endDate) setEndDate(fields.endDate);
        if ('startYear' in fields && fields.startYear) setStartYear(fields.startYear);
        if ('startQuarter' in fields && fields.startQuarter) setStartQuarter(fields.startQuarter);
        if ('endYear' in fields && fields.endYear) setEndYear(fields.endYear);
        if ('endQuarter' in fields && fields.endQuarter) setEndQuarter(fields.endQuarter);
      }
    } else {
      setTitle('');
      setDescription('');
      setStatus('backlog');
      setSize('');
      setParentId(scopeItemId ?? '');
      resetDateFields();
    }
  }, [editingItem, dialogOpen, scopeItemId]);

  const parentItem = parentId ? items.find((i) => i.id === parentId) : null;
  const parentDateRange = parentItem
    ? (parentItem.dateRange ?? computeEffectiveDateRange(parentItem, getItemChildren(items, parentItem.id)))
    : null;

  // Real-time date validation against parent timeframe
  useEffect(() => {
    if (!parentDateRange) {
      setDateWarning(null);
      return;
    }
    const dr = buildDateRange(size, startDate, endDate, startYear, startQuarter, endYear, endQuarter);
    if (dr) {
      setDateWarning(getDateRangeViolation(dr, parentDateRange));
    } else {
      setDateWarning(null);
    }
  }, [parentId, parentDateRange, size, startDate, endDate, startYear, startQuarter, endYear, endQuarter]);

  const availableParents = items.filter((i) => {
    if (editingItem) {
      if (i.id === editingItem.id) return false;
      const descendants = getDescendantIds(items, editingItem.id);
      if (descendants.has(i.id)) return false;
    }
    return true;
  });

  if (!dialogOpen) return null;

  const handleSizeChange = (newSize: InitiativeSize | '') => {
    setSize(newSize);
    resetDateFields();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const dateRange = buildDateRange(size, startDate, endDate, startYear, startQuarter, endYear, endQuarter);

    if (parentDateRange && dateRange) {
      const violation = getDateRangeViolation(dateRange, parentDateRange);
      if (violation) {
        setDateWarning(violation);
        return;
      }
    }

    if (editingItem) {
      updateItem(editingItem.id, {
        title: title.trim(),
        description: description.trim(),
        status,
        size: size || undefined,
        dateRange,
        parentId: parentId || undefined,
      });
    } else {
      addItem(title.trim(), description.trim(), status, undefined, size || undefined, dateRange, parentId || undefined);
    }
    closeDialog();
  };

  const renderDatePickers = () => {
    if (!size) return null;

    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 space-y-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date Range</p>

        {size === 'weeks' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Week</label>
              <input
                type="week"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Week</label>
              <input
                type="week"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        )}

        {size === 'months' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Month</label>
              <input
                type="month"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Month</label>
              <input
                type="month"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        )}

        {size === 'quarters' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Quarter</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value)}
                  placeholder="Year"
                  className={inputClass}
                />
                <select
                  value={startQuarter}
                  onChange={(e) => setStartQuarter(e.target.value)}
                  className={inputClass}
                >
                  {QUARTERS.map((q) => (
                    <option key={q.value} value={q.value}>{q.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Quarter</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={endYear}
                  onChange={(e) => setEndYear(e.target.value)}
                  placeholder="Year"
                  className={inputClass}
                />
                <select
                  value={endQuarter}
                  onChange={(e) => setEndQuarter(e.target.value)}
                  className={inputClass}
                >
                  {QUARTERS.map((q) => (
                    <option key={q.value} value={q.value}>{q.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {size === 'years' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Year</label>
              <input
                type="number"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="e.g. 2025"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Year</label>
              <input
                type="number"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="e.g. 2026"
                className={inputClass}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeDialog}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {editingItem ? 'Edit Item' : 'New Item'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="e.g. Implement authentication"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Add details about this item..."
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className={inputClass}
            >
              <option value="">None (root item)</option>
              {availableParents.map((i) => (
                <option key={i.id} value={i.id}>{i.title}</option>
              ))}
            </select>
            {(() => {
              const parentDepth = parentId ? getItemDepth(items, parentId) : -1;
              const itemDepth = parentDepth + 1;
              const itemLabel = getHierarchyLabel(itemDepth);
              return (
                <p className="text-xs text-gray-500 mt-1">
                  This item will be an <strong>{itemLabel}</strong>
                </p>
              );
            })()}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ItemStatus)}
              className={inputClass}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
            <select
              value={size}
              onChange={(e) => handleSizeChange(e.target.value as InitiativeSize | '')}
              className={inputClass}
            >
              <option value="">Select size...</option>
              {SIZES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {renderDatePickers()}

          {dateWarning && (
            <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm text-red-700">
              ⚠️ {dateWarning}
            </div>
          )}

          {parentDateRange && !dateWarning && parentItem?.size && (
            <div className="text-xs text-gray-500">
              Parent timeframe: {formatDateRange(parentItem.size, parentDateRange)}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeDialog}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {editingItem ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
