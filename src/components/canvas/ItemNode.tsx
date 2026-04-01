import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { formatDateRange, getItemDepth, getHierarchyLabel, getHierarchyColor, type RoadmapItem } from '../../types';
import { useRoadmapStore } from '../../store/roadmapStore';

const STATUS_COLORS: Record<string, { border: string; bg: string; badge: string }> = {
  backlog: { border: 'border-gray-300', bg: 'bg-white', badge: 'bg-gray-100 text-gray-600' },
  planned: { border: 'border-blue-300', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
  'in-progress': { border: 'border-amber-300', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700' },
  done: { border: 'border-green-300', bg: 'bg-green-50', badge: 'bg-green-100 text-green-700' },
};

function ItemNodeComponent({ data, selected }: NodeProps & { data: { item: RoadmapItem } }) {
  const { item } = data;
  const addItemAndConnect = useRoadmapStore((s) => s.addItemAndConnect);
  const items = useRoadmapStore((s) => s.items);
  const parentItem = item.parentId ? items.find((i) => i.id === item.parentId) : null;
  const depth = getItemDepth(items, item.id);
  const hierarchyLabel = getHierarchyLabel(depth);
  const hierarchyColors = getHierarchyColor(depth);
  const colors = STATUS_COLORS[item.status] ?? STATUS_COLORS.backlog;
  const completedMilestones = item.milestones.filter((m) => m.completed).length;
  const totalMilestones = item.milestones.length;

  return (
    <div
      className={`relative group rounded-lg border-2 ${colors.border} ${colors.bg} px-4 py-3 shadow-sm min-w-[180px] max-w-[260px] transition-shadow ${
        selected ? 'ring-2 ring-blue-500 shadow-md' : ''
      }`}
    >
      {/* Target handles (incoming edges) */}
      <Handle type="target" position={Position.Left} id="target-left" className="!w-1.5 !h-1.5 !bg-indigo-300 !border-0 !opacity-0 hover:!opacity-100" />
      <Handle type="target" position={Position.Top} id="target-top" className="!w-1.5 !h-1.5 !bg-indigo-300 !border-0 !opacity-0 hover:!opacity-100" />
      <Handle type="target" position={Position.Right} id="target-right" className="!w-1.5 !h-1.5 !bg-indigo-300 !border-0 !opacity-0 hover:!opacity-100" />
      <Handle type="target" position={Position.Bottom} id="target-bottom" className="!w-1.5 !h-1.5 !bg-indigo-300 !border-0 !opacity-0 hover:!opacity-100" />

      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-sm font-semibold text-gray-900 leading-tight">{item.title}</h3>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${colors.badge}`}>
          {item.status}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${hierarchyColors.bg} ${hierarchyColors.text} font-medium shrink-0`}>
          {hierarchyLabel}
        </span>
      </div>

      {parentItem && (
        <p className="text-[10px] text-gray-400 mb-0.5 truncate">↳ {parentItem.title}</p>
      )}

      {item.size && (
        <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 mb-1">
          📅 {item.dateRange ? formatDateRange(item.size, item.dateRange) : item.size}
        </span>
      )}

      {item.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-1">{item.description}</p>
      )}

      {totalMilestones > 0 && (
        <div className="flex items-center gap-1.5 mt-2">
          <div className="flex-1 h-1 rounded-full bg-gray-200">
            <div
              className="h-1 rounded-full bg-green-500 transition-all"
              style={{ width: `${(completedMilestones / totalMilestones) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-400">
            {completedMilestones}/{totalMilestones}
          </span>
        </div>
      )}

      {/* Right "+" button — left-to-right */}
      <button
        type="button"
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-indigo-500 text-white hover:bg-indigo-600 flex items-center justify-center text-sm leading-none opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={(e) => {
          e.stopPropagation();
          addItemAndConnect(item.id, 'right');
        }}
      >
        +
      </button>

      {/* Bottom "+" button — top-to-bottom */}
      <button
        type="button"
        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-6 h-6 rounded-full bg-indigo-500 text-white hover:bg-indigo-600 flex items-center justify-center text-sm leading-none opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={(e) => {
          e.stopPropagation();
          addItemAndConnect(item.id, 'down');
        }}
      >
        +
      </button>

      {/* Source handles (outgoing edges) */}
      <Handle type="source" position={Position.Left} id="source-left" className="!w-1.5 !h-1.5 !bg-indigo-300 !border-0 !opacity-0 hover:!opacity-100" />
      <Handle type="source" position={Position.Top} id="source-top" className="!w-1.5 !h-1.5 !bg-indigo-300 !border-0 !opacity-0 hover:!opacity-100" />
      <Handle type="source" position={Position.Right} id="source-right" className="!w-1.5 !h-1.5 !bg-indigo-300 !border-0 !opacity-0 hover:!opacity-100" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="!w-1.5 !h-1.5 !bg-indigo-300 !border-0 !opacity-0 hover:!opacity-100" />
    </div>
  );
}

export const ItemNode = memo(ItemNodeComponent);
