import { formatDateRange, getItemDepth, getHierarchyLabel, getHierarchyColor, type RoadmapItem } from '../../types';
import { useRoadmapStore } from '../../store/roadmapStore';

interface Props {
  item: RoadmapItem;
  connectionCount: number;
  isDragging: boolean;
  parentTitle?: string;
}

export function KanbanCard({ item, connectionCount, isDragging, parentTitle }: Props) {
  const items = useRoadmapStore((s) => s.items);
  const depth = getItemDepth(items, item.id);
  const hierarchyLabel = getHierarchyLabel(depth);
  const hierarchyColors = getHierarchyColor(depth);
  const completedMilestones = item.milestones.filter((m) => m.completed).length;
  const totalMilestones = item.milestones.length;

  return (
    <div
      className={`rounded-lg bg-white border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? 'shadow-lg ring-2 ring-blue-300' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <h4 className="text-sm font-medium text-gray-900">{item.title}</h4>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${hierarchyColors.bg} ${hierarchyColors.text} font-medium`}>
          {hierarchyLabel}
        </span>
      </div>

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
