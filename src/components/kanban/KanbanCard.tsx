import { formatDateRange, getItemDepth, getHierarchyLabel, getHierarchyColor, type RoadmapItem } from '../../types';
import { useRoadmapStore } from '../../store/roadmapStore';

interface Props {
  item: RoadmapItem;
  connectionCount: number;
  isDragging: boolean;
  parentTitle?: string;
  hideTitle?: boolean;
  isSelected?: boolean;
}

export function KanbanCard({ item, connectionCount, isDragging, parentTitle, hideTitle, isSelected }: Props) {
  const items = useRoadmapStore((s) => s.items);
  const connections = useRoadmapStore((s) => s.connections);
  const depth = getItemDepth(items, item.id);
  const hierarchyLabel = getHierarchyLabel(depth);
  const hierarchyColors = getHierarchyColor(depth);
  const completedMilestones = item.milestones.filter((m) => m.completed).length;
  const totalMilestones = item.milestones.length;

  const blockedBy = connections.filter((c) => c.targetId === item.id && c.type === 'blocking');
  const blockerNames = blockedBy.map((c) => items.find((i) => i.id === c.sourceId)?.title ?? '?');
  const isBlocked = blockedBy.length > 0;

  const isOrphaned = !!item.parentId && !items.find((i) => i.id === item.parentId);

  return (
    <div
      className={`rounded-lg bg-white border ${isOrphaned ? 'border-amber-400 bg-amber-50/50' : isBlocked ? 'border-red-300 bg-red-50/40' : 'border-gray-200'} p-3 cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? 'shadow-lg ring-2 ring-blue-300' : isSelected ? 'ring-2 ring-indigo-400 shadow-sm' : ''
      } ${hideTitle ? 'rounded-t-none border-t-0' : ''}`}
    >
      {!hideTitle && (
        <div className="flex items-center gap-1.5 mb-1">
          <h4 className="text-sm font-medium text-gray-900">{item.title}</h4>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${hierarchyColors.bg} ${hierarchyColors.text} font-medium`}>
            {hierarchyLabel}
          </span>
        </div>
      )}

      {isOrphaned && (
        <div className="relative mb-1.5 group/orphan">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-400 cursor-help">
            ⚠️ Orphaned
          </span>
          <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/orphan:block z-50 w-52 bg-gray-900 text-white text-xs rounded-md px-2.5 py-2 shadow-lg pointer-events-none">
            <span className="block font-semibold text-amber-300 mb-0.5">Orphaned Item</span>
            <span className="block text-gray-300">This item's parent no longer exists. Reassign or delete it to fix this.</span>
            <span className="absolute top-full left-3 border-4 border-transparent border-t-gray-900" />
          </div>
        </div>
      )}

      {isBlocked && (
        <div className="relative mb-1.5 group/blocked">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-300 cursor-help">
            🚫 Blocked by {blockedBy.length}
          </span>
          <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/blocked:block z-50 w-48 bg-gray-900 text-white text-xs rounded-md px-2.5 py-2 shadow-lg pointer-events-none">
            <span className="block font-semibold text-red-300 mb-0.5">Blocked by</span>
            {blockerNames.map((name, i) => (
              <span key={i} className="block truncate">• {name}</span>
            ))}
            <span className="absolute top-full left-3 border-4 border-transparent border-t-gray-900" />
          </div>
        </div>
      )}

      {parentTitle && (
        <p className="text-[10px] text-gray-400 mb-1 truncate">↳ {parentTitle}</p>
      )}

      {item.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{item.description}</p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-gray-400">
        {totalMilestones > 0 && (
          <span className="flex items-center gap-1">
            ✓ {completedMilestones}/{totalMilestones}
          </span>
        )}
        {connectionCount > 0 && (
          <span className="flex items-center gap-1">
            🔗 {connectionCount}
          </span>
        )}
        {item.size && (
          <span className="px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
            📅 {item.dateRange ? formatDateRange(item.size, item.dateRange) : item.size}
          </span>
        )}
      </div>

      {totalMilestones > 0 && (
        <div className="mt-2 h-1 rounded-full bg-gray-100">
          <div
            className="h-1 rounded-full bg-green-500 transition-all"
            style={{ width: `${(completedMilestones / totalMilestones) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
