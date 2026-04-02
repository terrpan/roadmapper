import { formatDateRange, getItemDepth, getHierarchyLabel, getHierarchyColor, type ConnectionType } from '../../types';
import { useRoadmapStore } from '../../store/roadmapStore';
import { MilestoneList } from '../shared/MilestoneList';

const STATUS_COLORS: Record<string, string> = {
  backlog: 'bg-gray-100 text-gray-700',
  planned: 'bg-blue-100 text-blue-700',
  'in-progress': 'bg-amber-100 text-amber-700',
  done: 'bg-green-100 text-green-700',
};

const CONNECTION_TYPES: { type: ConnectionType; icon: string; label: string; desc: string; active: string; inactive: string }[] = [
  {
    type: 'direct',
    icon: '🔗',
    label: 'Direct',
    desc: 'Hard dependency — this item must come before the next',
    active: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    inactive: 'bg-white text-gray-400 border-gray-200 hover:border-indigo-200 hover:text-indigo-500',
  },
  {
    type: 'indirect',
    icon: '↗',
    label: 'Indirect',
    desc: 'Loose relationship — related but not a hard dependency',
    active: 'bg-gray-100 text-gray-700 border-gray-400',
    inactive: 'bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600',
  },
  {
    type: 'blocking',
    icon: '🚫',
    label: 'Blocking',
    desc: 'Hard blocker — the other item cannot start until this is done',
    active: 'bg-red-100 text-red-700 border-red-300',
    inactive: 'bg-white text-gray-400 border-gray-200 hover:border-red-200 hover:text-red-500',
  },
];

function TypePicker({
  value,
  canBlock,
  onChange,
}: {
  value: ConnectionType;
  canBlock: boolean;
  onChange: (type: ConnectionType) => void;
}) {
  return (
    <div className="flex gap-1">
      {CONNECTION_TYPES.map((opt) => {
        const disabled = opt.type === 'blocking' && !canBlock;
        const isActive = value === opt.type;
        return (
          <div key={opt.type} className="group/tip relative">
            <button
              onClick={() => !disabled && onChange(opt.type)}
              disabled={disabled}
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors ${
                disabled
                  ? 'opacity-30 cursor-not-allowed bg-white text-gray-300 border-gray-200'
                  : isActive
                    ? opt.active
                    : opt.inactive
              }`}
            >
              {opt.icon} {opt.label}
            </button>
            <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/tip:block z-50 w-48 bg-gray-900 text-white text-xs rounded-md px-2.5 py-2 shadow-lg pointer-events-none">
              <p className="font-semibold mb-0.5">{opt.icon} {opt.label}</p>
              <p className="text-gray-300 leading-snug">{opt.desc}</p>
              {disabled && <p className="text-amber-300 mt-1 leading-snug">Only available between items at the same hierarchy level.</p>}
              <span className="absolute top-full left-3 border-4 border-transparent border-t-gray-900" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Sidebar() {
  const selectedItemId = useRoadmapStore((s) => s.selectedItemId);
  const items = useRoadmapStore((s) => s.items);
  const connections = useRoadmapStore((s) => s.connections);
  const openEditDialog = useRoadmapStore((s) => s.openEditDialog);
  const deleteItem = useRoadmapStore((s) => s.deleteItem);
  const selectItem = useRoadmapStore((s) => s.selectItem);
  const updateConnectionType = useRoadmapStore((s) => s.updateConnectionType);
  const removeConnection = useRoadmapStore((s) => s.removeConnection);

  const item = items.find((i) => i.id === selectedItemId);

  if (!item) {
    return (
      <aside className="w-72 shrink-0 border-l border-gray-200 bg-white p-4 overflow-y-auto">
        <p className="text-sm text-gray-400 mt-8 text-center">
          Select an item to see details
        </p>
      </aside>
    );
  }

  const incoming = connections.filter((c) => c.targetId === item.id);
  const outgoing = connections.filter((c) => c.sourceId === item.id);

  return (
    <aside className="w-72 shrink-0 border-l border-gray-200 bg-white p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900 truncate pr-2">{item.title}</h2>
        <button
          onClick={() => selectItem(null)}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[item.status]}`}>
          {item.status}
        </span>
        {(() => {
          const depth = getItemDepth(items, item.id);
          const label = getHierarchyLabel(depth);
          const hColors = getHierarchyColor(depth);
          return (
            <span className={`text-xs px-2 py-0.5 rounded-full ${hColors.bg} ${hColors.text} font-medium`}>
              {label}
            </span>
          );
        })()}
      </div>

      {item.size && (
        <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-3 ml-2 bg-purple-100 text-purple-700">
          📅 {item.dateRange ? formatDateRange(item.size, item.dateRange) : item.size}
        </span>
      )}

      {item.parentId && (() => {
        const parent = items.find((i) => i.id === item.parentId);
        return parent ? (
          <div className="mb-3">
            <span className="text-xs text-gray-400">Parent: </span>
            <button
              onClick={() => selectItem(parent.id)}
              className="text-xs text-blue-600 hover:underline"
            >
              {parent.title}
            </button>
          </div>
        ) : (
          <div className="mb-3 flex items-start gap-1.5 rounded-md bg-amber-50 border border-amber-300 px-2.5 py-2">
            <span className="text-amber-500 mt-0.5 shrink-0">⚠️</span>
            <div>
              <p className="text-xs font-semibold text-amber-800">Orphaned item</p>
              <p className="text-[11px] text-amber-700 mt-0.5">Parent no longer exists. Reassign a parent or delete this item.</p>
            </div>
          </div>
        );
      })()}

      {(() => {
        const children = items.filter((i) => i.parentId === item.id);
        return children.length > 0 ? (
          <div className="mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Children</h3>
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => selectItem(child.id)}
                className="block text-xs text-blue-600 hover:underline mb-0.5"
              >
                {child.title}
              </button>
            ))}
          </div>
        ) : null;
      })()}

      {item.description && (
        <p className="text-sm text-gray-600 mb-4 whitespace-pre-wrap">{item.description}</p>
      )}

      <MilestoneList itemId={item.id} milestones={item.milestones} />

      {(incoming.length > 0 || outgoing.length > 0) && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Connections</h3>
          {incoming.map((c) => {
            const source = items.find((i) => i.id === c.sourceId);
            const connType = c.type ?? 'direct';
            const isIncomingBlock = connType === 'blocking';
            return (
              <div key={c.id} className="mb-2.5 text-xs text-gray-500">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-gray-400">←</span>
                  <span className="font-medium text-gray-700 truncate flex-1">{source?.title ?? '?'}</span>
                  {!isIncomingBlock && (
                    <button
                      onClick={() => removeConnection(c.id)}
                      className="shrink-0 text-gray-300 hover:text-red-500 transition-colors leading-none"
                      title="Remove connection"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {isIncomingBlock ? (
                  <div className="group relative inline-flex">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-300 cursor-help">
                      🚫 Blocking (read-only)
                    </span>
                    <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover:block z-50 w-48 bg-gray-900 text-white text-xs rounded-md px-2.5 py-2 shadow-lg pointer-events-none">
                      <p className="font-semibold text-red-300 mb-0.5">Blocked by this item</p>
                      <p className="text-gray-300 leading-snug">Only the source item can change or remove a blocking connection.</p>
                    </div>
                  </div>
                ) : (
                  <TypePicker
                    value={connType}
                    canBlock={false}
                    onChange={(t) => updateConnectionType(c.id, t)}
                  />
                )}
              </div>
            );
          })}
          {outgoing.map((c) => {
            const target = items.find((i) => i.id === c.targetId);
            const connType = c.type ?? 'direct';
            const srcDepth = getItemDepth(items, c.sourceId);
            const tgtDepth = getItemDepth(items, c.targetId);
            const canBlock = srcDepth === tgtDepth;
            return (
              <div key={c.id} className="mb-2.5 text-xs text-gray-500">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-gray-400">→</span>
                  <span className="font-medium text-gray-700 truncate flex-1">{target?.title ?? '?'}</span>
                  <button
                    onClick={() => removeConnection(c.id)}
                    className="shrink-0 text-gray-300 hover:text-red-500 transition-colors leading-none"
                    title="Remove connection"
                  >
                    ✕
                  </button>
                </div>
                <TypePicker
                  value={connType}
                  canBlock={canBlock}
                  onChange={(t) => updateConnectionType(c.id, t)}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <button
          onClick={() => openEditDialog(item.id)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Edit
        </button>
        <button
          onClick={() => { deleteItem(item.id); selectItem(null); }}
          className="flex-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </aside>
  );
}
