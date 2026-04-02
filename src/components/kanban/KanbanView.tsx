import { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import type { ItemStatus, RoadmapItem } from '../../types';
import { getHierarchyColor, getHierarchyLabel, getItemDepth } from '../../types';
import { useRoadmapStore } from '../../store/roadmapStore';
import { KanbanCard } from './KanbanCard';

const COLUMNS: { id: ItemStatus; title: string; color: string }[] = [
  { id: 'backlog', title: 'Backlog', color: 'border-t-gray-400' },
  { id: 'planned', title: 'Planned', color: 'border-t-blue-400' },
  { id: 'in-progress', title: 'In Progress', color: 'border-t-amber-400' },
  { id: 'done', title: 'Done', color: 'border-t-green-400' },
];

const STATUS_OPTIONS: { id: ItemStatus; label: string; style: string }[] = [
  { id: 'backlog', label: 'Backlog', style: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  { id: 'planned', label: 'Planned', style: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
  { id: 'in-progress', label: 'In Progress', style: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
  { id: 'done', label: 'Done', style: 'bg-green-100 text-green-700 hover:bg-green-200' },
];

type FlatItem = {
  item: RoadmapItem;
  depth: number;
  hasChildren: boolean;
};

/** Build a depth-first flat list of all column items in hierarchy order. */
function buildFlatTree(
  columnItems: RoadmapItem[],
  allItems: RoadmapItem[],
  collapsed: Set<string>,
): FlatItem[] {
  const columnItemIds = new Set(columnItems.map((i) => i.id));
  const childMap = new Map<string, RoadmapItem[]>();
  for (const item of columnItems) {
    const parentId = item.parentId ?? '__root__';
    if (!childMap.has(parentId)) childMap.set(parentId, []);
    childMap.get(parentId)!.push(item);
  }

  // Root items: those whose parentId is not in columnItems
  const roots = columnItems.filter(
    (i) => !i.parentId || !columnItemIds.has(i.parentId)
  );

  const result: FlatItem[] = [];

  function walk(item: RoadmapItem, depth: number) {
    const children = childMap.get(item.id) ?? [];
    result.push({ item, depth, hasChildren: children.length > 0 });
    if (!collapsed.has(item.id)) {
      for (const child of children) {
        walk(child, depth + 1);
      }
    }
  }

  for (const root of roots) {
    const depth = getItemDepth(allItems, root.id);
    walk(root, depth);
  }

  return result;
}

export function KanbanView() {
  const items = useRoadmapStore((s) => s.items);
  const connections = useRoadmapStore((s) => s.connections);
  const updateItemStatus = useRoadmapStore((s) => s.updateItemStatus);
  const selectItem = useRoadmapStore((s) => s.selectItem);
  const scopeItemId = useRoadmapStore((s) => s.scopeItemId);
  const searchQuery = useRoadmapStore((s) => s.searchQuery);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const scopedItems = useMemo(() => {
    if (scopeItemId === null) return items;
    const ids = new Set<string>();
    const queue = [scopeItemId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      ids.add(current);
      for (const item of items) {
        if (item.parentId === current && !ids.has(item.id)) {
          ids.add(item.id);
          queue.push(item.id);
        }
      }
    }
    return items.filter((i) => ids.has(i.id));
  }, [items, scopeItemId]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return scopedItems;
    const q = searchQuery.toLowerCase();
    return scopedItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
    );
  }, [scopedItems, searchQuery]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCardClick = (e: React.MouseEvent, itemId: string) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(itemId)) next.delete(itemId);
        else next.add(itemId);
        return next;
      });
    } else {
      setSelectedIds(new Set());
      selectItem(itemId);
    }
  };

  const bulkUpdateStatus = (status: ItemStatus) => {
    for (const id of selectedIds) {
      updateItemStatus(id, status);
    }
    setSelectedIds(new Set());
  };

  const grouped = COLUMNS.map((col) => ({
    ...col,
    items: filteredItems.filter((item) => item.status === col.id),
  }));

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId as ItemStatus;
    // If the dragged card is part of a multi-selection, move all selected
    if (selectedIds.has(result.draggableId) && selectedIds.size > 1) {
      for (const id of selectedIds) {
        updateItemStatus(id, newStatus);
      }
      setSelectedIds(new Set());
    } else {
      updateItemStatus(result.draggableId, newStatus);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Multi-select action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border-b border-indigo-200 shrink-0">
          <span className="text-sm font-medium text-indigo-700">
            {selectedIds.size} selected
          </span>
          <span className="text-indigo-300 mx-1">·</span>
          <span className="text-xs text-indigo-500 mr-1">Move to:</span>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => bulkUpdateStatus(opt.id)}
              className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${opt.style}`}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-indigo-400 hover:text-indigo-600 transition-colors"
          >
            ✕ Clear
          </button>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 flex gap-4 p-4 overflow-x-auto">
          {grouped.map((column) => {
            const flatItems = buildFlatTree(column.items, items, collapsedGroups);
            const indexMap = new Map(flatItems.map((fi, i) => [fi.item.id, i]));

            return (
              <div
                key={column.id}
                className={`flex flex-col w-72 shrink-0 rounded-lg bg-gray-100 border-t-4 ${column.color}`}
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <h3 className="text-sm font-semibold text-gray-700">{column.title}</h3>
                  <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">
                    {column.items.length}
                  </span>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 px-2 pb-2 min-h-[100px] transition-colors ${
                        snapshot.isDraggingOver ? 'bg-gray-200/50' : ''
                      }`}
                    >
                      {flatItems.map((fi) => {
                        const { item, depth, hasChildren } = fi;
                        const isCollapsed = collapsedGroups.has(item.id);
                        const colors = getHierarchyColor(depth);
                        const label = getHierarchyLabel(depth);
                        const indent = (depth) * 12;
                        const isSelected = selectedIds.has(item.id);

                        return (
                          <Draggable
                            key={item.id}
                            draggableId={item.id}
                            index={indexMap.get(item.id)!}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={{
                                  ...provided.draggableProps.style,
                                  marginLeft: indent,
                                  marginBottom: 8,
                                }}
                                onClick={(e) => handleCardClick(e, item.id)}
                              >
                                {/* Collapse toggle for items with children */}
                                {hasChildren && (
                                  <div
                                    className={`flex items-center gap-1 px-1 py-0.5 rounded-t-md border-b mb-0 ${colors.bg} ${colors.border}`}
                                    style={{ borderWidth: '1px' }}
                                    onClick={(e) => { e.stopPropagation(); toggleGroup(item.id); }}
                                  >
                                    <button className={`text-xs leading-none ${colors.text}`}>
                                      {isCollapsed ? '▸' : '▾'}
                                    </button>
                                    <span className={`text-[10px] font-semibold ${colors.text} truncate flex-1`}>
                                      {item.title}
                                    </span>
                                    <span className={`text-[9px] px-1 py-0.5 rounded ${colors.bg} ${colors.text} font-medium shrink-0`}>
                                      {label}
                                    </span>
                                  </div>
                                )}
                                <KanbanCard
                                  item={item}
                                  connectionCount={
                                    connections.filter(
                                      (c) => c.sourceId === item.id || c.targetId === item.id
                                    ).length
                                  }
                                  isDragging={snapshot.isDragging}
                                  parentTitle={items.find((i) => i.id === item.parentId)?.title}
                                  hideTitle={hasChildren}
                                  isSelected={isSelected}
                                />
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
