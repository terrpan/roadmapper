import { formatDateRange, getItemDepth, getHierarchyLabel, getHierarchyColor } from '../../types';
import { useRoadmapStore } from '../../store/roadmapStore';
import { MilestoneList } from '../shared/MilestoneList';

const STATUS_COLORS: Record<string, string> = {
  backlog: 'bg-gray-100 text-gray-700',
  planned: 'bg-blue-100 text-blue-700',
  'in-progress': 'bg-amber-100 text-amber-700',
  done: 'bg-green-100 text-green-700',
};

export function Sidebar() {
  const selectedItemId = useRoadmapStore((s) => s.selectedItemId);
  const items = useRoadmapStore((s) => s.items);
  const connections = useRoadmapStore((s) => s.connections);
  const openEditDialog = useRoadmapStore((s) => s.openEditDialog);
  const deleteItem = useRoadmapStore((s) => s.deleteItem);
  const selectItem = useRoadmapStore((s) => s.selectItem);
  const updateConnectionType = useRoadmapStore((s) => s.updateConnectionType);

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
        ) : null;
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
            return (
              <div key={c.id} className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                <span>← from <span className="font-medium text-gray-700">{source?.title ?? '?'}</span></span>
                <button
                  onClick={() => updateConnectionType(c.id, connType === 'direct' ? 'indirect' : 'direct')}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    connType === 'indirect'
                      ? 'border border-dashed border-gray-400 text-gray-500'
                      : 'bg-indigo-100 text-indigo-700'
                  }`}
                >
                  {connType === 'indirect' ? 'Indirect' : 'Direct'}
                </button>
              </div>
            );
          })}
          {outgoing.map((c) => {
            const target = items.find((i) => i.id === c.targetId);
            const connType = c.type ?? 'direct';
            return (
              <div key={c.id} className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                <span>→ to <span className="font-medium text-gray-700">{target?.title ?? '?'}</span></span>
                <button
                  onClick={() => updateConnectionType(c.id, connType === 'direct' ? 'indirect' : 'direct')}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    connType === 'indirect'
                      ? 'border border-dashed border-gray-400 text-gray-500'
                      : 'bg-indigo-100 text-indigo-700'
                  }`}
                >
                  {connType === 'indirect' ? 'Indirect' : 'Direct'}
                </button>
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
