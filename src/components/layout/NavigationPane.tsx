import { useState } from 'react';
import { useRoadmapStore } from '../../store/roadmapStore';
import { getItemChildren, getHierarchyLabel, getHierarchyColor, GROUP_COLORS } from '../../types';
import type { RoadmapItem } from '../../types';

export default function NavigationPane() {
  const items = useRoadmapStore((s) => s.items);
  const scopeItemId = useRoadmapStore((s) => s.scopeItemId);
  const setScopeItem = useRoadmapStore((s) => s.setScopeItem);
  const groups = useRoadmapStore((s) => s.groups);
  const setSelectedNodeIds = useRoadmapStore((s) => s.setSelectedNodeIds);
  const deleteGroup = useRoadmapStore((s) => s.deleteGroup);
  const updateGroup = useRoadmapStore((s) => s.updateGroup);
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);

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

        {/* Groups section */}
        <div className="border-t border-gray-200 mt-2 pt-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-1">
            Groups
          </h3>

          {groups.length === 0 ? (
            <p className="text-xs text-gray-400 px-2 py-1">No groups yet</p>
          ) : (
            groups.map((group) => (
              <div key={group.id} className="relative">
                <div
                  className="group/row flex items-center gap-1.5 px-2 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                  onClick={() => setSelectedNodeIds(group.itemIds)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setColorPickerOpen(colorPickerOpen === group.id ? null : group.id);
                    }}
                    className="w-3 h-3 rounded-full shrink-0 border border-gray-300 hover:scale-125 transition-transform"
                    style={{ backgroundColor: GROUP_COLORS[group.colorIndex % GROUP_COLORS.length].border }}
                    title="Change color"
                  />
                  <span className="flex-1 truncate">{group.label}</span>
                  <span className="text-[10px] text-gray-400 tabular-nums shrink-0">
                    {group.itemIds.length}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteGroup(group.id);
                    }}
                    className="text-gray-300 hover:text-red-500 text-xs w-4 text-center opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0"
                    title="Ungroup"
                  >
                    ✕
                  </button>
                </div>
                {colorPickerOpen === group.id && (
                  <div className="flex gap-1 px-2 py-1.5 bg-gray-50 rounded ml-2">
                    {GROUP_COLORS.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => { updateGroup(group.id, { colorIndex: i }); setColorPickerOpen(null); }}
                        className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${group.colorIndex === i ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c.border }}
                        title={c.label}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
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
