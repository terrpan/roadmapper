import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import type { ItemStatus, RoadmapItem } from '../../types';
import { useRoadmapStore } from '../../store/roadmapStore';
import { KanbanCard } from './KanbanCard';

const COLUMNS: { id: ItemStatus; title: string; color: string }[] = [
  { id: 'backlog', title: 'Backlog', color: 'border-t-gray-400' },
  { id: 'planned', title: 'Planned', color: 'border-t-blue-400' },
  { id: 'in-progress', title: 'In Progress', color: 'border-t-amber-400' },
  { id: 'done', title: 'Done', color: 'border-t-green-400' },
];

type RenderInstruction =
  | { type: 'standalone'; item: RoadmapItem }
  | { type: 'group-header'; item: RoadmapItem; children: RoadmapItem[] }
  | { type: 'orphan'; item: RoadmapItem };

function groupItemsForColumn(
  columnItems: RoadmapItem[],
  _allItems: RoadmapItem[]
): RenderInstruction[] {
  const columnItemIds = new Set(columnItems.map((i) => i.id));
  const result: RenderInstruction[] = [];
  const handledIds = new Set<string>();

  for (const item of columnItems) {
    if (handledIds.has(item.id)) continue;
    if (!item.parentId || !columnItemIds.has(item.parentId)) {
      const children = columnItems.filter((ci) => ci.parentId === item.id);
      if (children.length > 0) {
        result.push({ type: 'group-header', item, children });
        children.forEach((c) => handledIds.add(c.id));
      } else if (!item.parentId) {
        result.push({ type: 'standalone', item });
      } else {
        result.push({ type: 'orphan', item });
      }
      handledIds.add(item.id);
    }
  }

  for (const item of columnItems) {
    if (!handledIds.has(item.id)) {
      result.push({ type: 'orphan', item });
    }
  }

  return result;
}

export function KanbanView() {
  const items = useRoadmapStore((s) => s.items);
  const connections = useRoadmapStore((s) => s.connections);
  const updateItemStatus = useRoadmapStore((s) => s.updateItemStatus);
  const selectItem = useRoadmapStore((s) => s.selectItem);
  const scopeItemId = useRoadmapStore((s) => s.scopeItemId);

  const scopedItems = scopeItemId === null
    ? items.filter((i) => !i.parentId)
    : items.filter((i) => i.parentId === scopeItemId);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const grouped = COLUMNS.map((col) => ({
    ...col,
    items: scopedItems.filter((item) => item.status === col.id),
  }));

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId as ItemStatus;
    updateItemStatus(result.draggableId, newStatus);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex-1 flex gap-4 p-4 overflow-x-auto">
        {grouped.map((column) => {
          const renderInstructions = groupItemsForColumn(column.items, items);

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
                {(provided, snapshot) => {
                  // Build a flat ordered list of draggable items to assign sequential indices
                  const draggableOrder: RoadmapItem[] = [];
                  for (const instruction of renderInstructions) {
                    if (instruction.type === 'group-header') {
                      const isCollapsed = collapsedGroups.has(instruction.item.id);
                      if (!isCollapsed) {
                        draggableOrder.push(...instruction.children);
                      }
                    } else {
                      draggableOrder.push(instruction.item);
                    }
                  }
                  const indexMap = new Map(draggableOrder.map((item, i) => [item.id, i]));

                  return (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 px-2 pb-2 space-y-2 min-h-[100px] transition-colors ${
                        snapshot.isDraggingOver ? 'bg-gray-200/50' : ''
                      }`}
                    >
                      {renderInstructions.map((instruction) => {
                        if (instruction.type === 'group-header') {
                          const { item, children } = instruction;
                          const isCollapsed = collapsedGroups.has(item.id);
                          return (
                            <div key={item.id}>
                              <div className="flex items-center gap-1 px-1 py-0.5 bg-indigo-50 rounded-md border border-indigo-100 mb-1">
                                <button
                                  onClick={() => toggleGroup(item.id)}
                                  className="text-indigo-400 text-xs leading-none"
                                >
                                  {isCollapsed ? '▸' : '▾'}
                                </button>
                                <span className="text-xs font-medium text-indigo-700 truncate">
                                  {item.title}
                                </span>
                                <span className="ml-auto text-[10px] text-indigo-400">
                                  {children.length}
                                </span>
                              </div>
                              {!isCollapsed &&
                                children.map((child) => (
                                  <Draggable
                                    key={child.id}
                                    draggableId={child.id}
                                    index={indexMap.get(child.id)!}
                                  >
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className="pl-2 border-l-2 border-indigo-200 ml-1 mb-2"
                                        onClick={() => selectItem(child.id)}
                                      >
                                        <KanbanCard
                                          item={child}
                                          connectionCount={
                                            connections.filter(
                                              (c) =>
                                                c.sourceId === child.id || c.targetId === child.id
                                            ).length
                                          }
                                          isDragging={snapshot.isDragging}
                                          parentTitle={item.title}
                                        />
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                            </div>
                          );
                        }

                        // standalone or orphan
                        const { item } = instruction;
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
                                onClick={() => selectItem(item.id)}
                              >
                                <KanbanCard
                                  item={item}
                                  connectionCount={
                                    connections.filter(
                                      (c) => c.sourceId === item.id || c.targetId === item.id
                                    ).length
                                  }
                                  isDragging={snapshot.isDragging}
                                  parentTitle={items.find((i) => i.id === item.parentId)?.title}
                                />
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  );
                }}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
