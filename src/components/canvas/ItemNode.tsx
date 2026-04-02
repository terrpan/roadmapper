import { memo, useState, useRef, useEffect } from 'react';
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
  const connections = useRoadmapStore((s) => s.connections);
  const connectingFrom = useRoadmapStore((s) => s.connectingFrom);
  const connectingFromNodeId = connectingFrom?.nodeId ?? null;
  const setConnectingFromNode = useRoadmapStore((s) => s.setConnectingFromNode);
  const addConnection = useRoadmapStore((s) => s.addConnection);
  const parentItem = item.parentId ? items.find((i) => i.id === item.parentId) : null;
  const depth = getItemDepth(items, item.id);
  const hierarchyLabel = getHierarchyLabel(depth);
  const hierarchyColors = getHierarchyColor(depth);
  const colors = STATUS_COLORS[item.status] ?? STATUS_COLORS.backlog;
  const completedMilestones = item.milestones.filter((m) => m.completed).length;
  const totalMilestones = item.milestones.length;

  const blockedBy = connections.filter((c) => c.targetId === item.id && c.type === 'blocking');
  const blockerNames = blockedBy.map((c) => items.find((i) => i.id === c.sourceId)?.title ?? '?');
  const isBlocked = blockedBy.length > 0;

  const isOrphaned = !!item.parentId && !items.find((i) => i.id === item.parentId);

  // If another node is waiting for a connection target, this node is a potential target
  const isConnectTarget = connectingFromNodeId !== null && connectingFromNodeId !== item.id;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleClass = '!w-1.5 !h-1.5 !bg-indigo-300 !border-0 !opacity-0 hover:!opacity-100';

  return (
    <div
      className={`relative group rounded-lg border-2 ${isOrphaned ? 'border-amber-400 bg-amber-50/60' : isBlocked ? 'border-red-400 bg-red-50/50' : `${colors.border} ${colors.bg}`} px-4 py-3 shadow-sm min-w-[180px] max-w-[260px] transition-shadow ${
        selected ? 'ring-2 ring-blue-500 shadow-md' : ''
      }`}
    >
      {/* Target handles (incoming edges) */}
      <Handle type="target" position={Position.Left} id="target-left" className={handleClass} />
      <Handle type="target" position={Position.Top} id="target-top" className={handleClass} />
      <Handle type="target" position={Position.Right} id="target-right" className={handleClass} />
      <Handle type="target" position={Position.Bottom} id="target-bottom" className={handleClass} />

      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-sm font-semibold text-gray-900 leading-tight">{item.title}</h3>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${colors.badge}`}>
          {item.status}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${hierarchyColors.bg} ${hierarchyColors.text} font-medium shrink-0`}>
          {hierarchyLabel}
        </span>
      </div>

      {isOrphaned && (
        <div className="relative mb-1 group/orphan">
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
        <div className="relative mb-1 group/blocked">
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

      {/* "+" action button with popover menu */}
      <div className="absolute -right-3 top-1/2 -translate-y-1/2 z-20" ref={menuRef}>
        <button
          type="button"
          className="w-6 h-6 rounded-full bg-indigo-500 text-white hover:bg-indigo-600 flex items-center justify-center text-sm leading-none opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
        >
          +
        </button>
        {menuOpen && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-52 z-50">
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                addItemAndConnect(item.id, 'right');
              }}
            >
              <span className="text-sm">➕</span> New child (right)
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                addItemAndConnect(item.id, 'down');
              }}
            >
              <span className="text-sm">⬇</span> New child (below)
            </button>
            <div className="border-t border-gray-100 my-0.5" />
            <div className="px-3 pt-1.5 pb-0.5">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Connect to…</span>
            </div>
            {([
              {
                type: 'direct' as const,
                icon: '🔗',
                label: 'Direct',
                desc: 'Hard dependency — this leads to that',
                color: 'text-indigo-700',
                hover: 'hover:bg-indigo-50',
              },
              {
                type: 'indirect' as const,
                icon: '↗',
                label: 'Indirect',
                desc: 'Loose relationship, not a hard dep',
                color: 'text-gray-600',
                hover: 'hover:bg-gray-50',
              },
              {
                type: 'blocking' as const,
                icon: '🚫',
                label: 'Blocking',
                desc: 'Blocks the other — must finish first',
                color: 'text-red-700',
                hover: 'hover:bg-red-50',
              },
            ] as const).map((opt) => (
              <button
                key={opt.type}
                className={`w-full text-left px-3 py-1.5 text-xs ${opt.color} ${opt.hover} flex items-start gap-2`}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  setConnectingFromNode(item.id, opt.type);
                }}
              >
                <span className="text-sm shrink-0 mt-px">{opt.icon}</span>
                <span>
                  <span className="font-semibold block">{opt.label}</span>
                  <span className="text-[10px] text-gray-400 font-normal leading-tight">{opt.desc}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* When another node is connecting, show a "click to connect" target overlay */}
      {isConnectTarget && (
        <button
          type="button"
          className={`absolute inset-0 z-30 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${
            connectingFrom?.type === 'blocking'
              ? 'bg-red-500/10 border-red-400 hover:bg-red-500/20'
              : connectingFrom?.type === 'indirect'
                ? 'bg-gray-500/10 border-gray-400 hover:bg-gray-500/20'
                : 'bg-indigo-500/10 border-indigo-400 hover:bg-indigo-500/20'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            addConnection(connectingFromNodeId!, item.id, undefined, connectingFrom?.type ?? 'direct');
            setConnectingFromNode(null);
          }}
        >
          <span className={`text-xs font-semibold bg-white/90 px-2 py-1 rounded shadow-sm ${
            connectingFrom?.type === 'blocking' ? 'text-red-700' : connectingFrom?.type === 'indirect' ? 'text-gray-700' : 'text-indigo-700'
          }`}>
            {connectingFrom?.type === 'blocking' ? '🚫 Set as blocking' : connectingFrom?.type === 'indirect' ? '↗ Set as indirect' : '🔗 Set as direct'}
          </span>
        </button>
      )}

      {/* Source handles (outgoing edges) */}
      <Handle type="source" position={Position.Left} id="source-left" className={handleClass} />
      <Handle type="source" position={Position.Top} id="source-top" className={handleClass} />
      <Handle type="source" position={Position.Right} id="source-right" className={handleClass} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className={handleClass} />
    </div>
  );
}

export const ItemNode = memo(ItemNodeComponent);
