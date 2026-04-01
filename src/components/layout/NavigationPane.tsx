import { useState } from 'react';
import { useRoadmapStore } from '../../store/roadmapStore';
import { getItemChildren, getHierarchyLabel, getHierarchyColor } from '../../types';
import type { RoadmapItem } from '../../types';

export default function NavigationPane() {
  const items = useRoadmapStore((s) => s.items);
  const scopeItemId = useRoadmapStore((s) => s.scopeItemId);
  const setScopeItem = useRoadmapStore((s) => s.setScopeItem);

  const rootItems = items.filter((i) => !i.parentId);

  return (
    <div className="w-56 bg-gray-50 border-r border-gray-200 flex flex-col h-full overflow-hidden shrink-0">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-white">
        <h2 className="text-sm font-semibold text-gray-700">Initiatives</h2>
      </div>

      {/* Scrollable tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {/* "All Items" root option */}
        <button
          onClick={() => setScopeItem(null)}
          className={`w-full text-left px-2 py-1.5 rounded text-sm ${
            scopeItemId === null
              ? 'bg-indigo-100 text-indigo-800 font-medium'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          📋 All Initiatives
        </button>

        {/* Recursive tree */}
        {rootItems.map((item) => (
          <NavItem key={item.id} item={item} items={items} depth={0} />
        ))}
      </div>
    </div>
  );
}

function NavItem({
  item,
  items,
  depth,
}: {
  item: RoadmapItem;
  items: RoadmapItem[];
  depth: number;
}) {
  const scopeItemId = useRoadmapStore((s) => s.scopeItemId);
  const setScopeItem = useRoadmapStore((s) => s.setScopeItem);
  const [expanded, setExpanded] = useState(true);

  const children = getItemChildren(items, item.id);
  const isActive = scopeItemId === item.id;
  const colors = getHierarchyColor(depth);
  const label = getHierarchyLabel(depth);

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer text-sm ${
          isActive
            ? 'bg-indigo-100 text-indigo-800 font-medium'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/collapse toggle */}
        {children.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="text-gray-400 hover:text-gray-600 text-xs w-4"
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Item title - click to scope */}
        <button
          onClick={() => setScopeItem(item.id)}
          className="flex-1 text-left truncate"
        >
          {item.title}
        </button>

        {/* Level badge */}
        <span
          className={`text-[9px] px-1 py-0.5 rounded ${colors.bg} ${colors.text} shrink-0`}
        >
          {label}
        </span>
      </div>

      {/* Children */}
      {expanded &&
        children.map((child) => (
          <NavItem key={child.id} item={child} items={items} depth={depth + 1} />
        ))}
    </div>
  );
}
