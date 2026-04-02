import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useReactFlow,
  useOnViewportChange,
  SelectionMode,
  ConnectionMode,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnConnect,
  type NodeTypes,
  type Viewport,
  applyNodeChanges,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRoadmapStore } from '../../store/roadmapStore';
import { ItemNode } from './ItemNode';
import { buildHierarchyTree, getItemDepth, GROUP_COLORS } from '../../types';

const nodeTypes: NodeTypes = {
  roadmapItem: ItemNode,
};

function SnapGuidesOverlay({
  snapLines,
}: {
  snapLines: {
    horizontal: Array<{ y: number; x1: number; x2: number }>;
    vertical: Array<{ x: number; y1: number; y2: number }>;
  };
}) {
  const { getViewport } = useReactFlow();
  const { x: tx, y: ty, zoom } = getViewport();

  // Convert flow coordinate to screen coordinate
  const toScreen = (fx: number, fy: number) => ({
    sx: fx * zoom + tx,
    sy: fy * zoom + ty,
  });

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      {snapLines.horizontal.map((line, i) => {
        const start = toScreen(line.x1, line.y);
        const end = toScreen(line.x2, line.y);
        return (
          <line
            key={`h-${i}`}
            x1={start.sx}
            y1={start.sy}
            x2={end.sx}
            y2={end.sy}
            stroke="#6366f1"
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity="0.7"
          />
        );
      })}
      {snapLines.vertical.map((line, i) => {
        const start = toScreen(line.x, line.y1);
        const end = toScreen(line.x, line.y2);
        return (
          <line
            key={`v-${i}`}
            x1={start.sx}
            y1={start.sy}
            x2={end.sx}
            y2={end.sy}
            stroke="#6366f1"
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity="0.7"
          />
        );
      })}
    </svg>
  );
}

function ToolbarButton({
  onClick,
  label,
  description,
  active,
  children,
}: {
  onClick: () => void;
  label: string;
  description?: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`w-8 h-8 flex items-center justify-center text-sm rounded transition-colors ${
          active
            ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
            : 'hover:bg-gray-100 text-gray-600 hover:text-gray-800'
        }`}
      >
        {children}
      </button>
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:block z-50 whitespace-nowrap">
        <div className="bg-gray-900 text-white text-xs rounded px-2 py-1">
          <div className="font-medium">{label}</div>
          {description && <div className="text-gray-300 text-[10px]">{description}</div>}
        </div>
      </div>
    </div>
  );
}

function GroupOverlay() {
  const { getViewport } = useReactFlow();
  const [viewport, setViewport] = useState<Viewport>(getViewport());

  useOnViewportChange({
    onChange: (vp) => setViewport(vp),
    onEnd: (vp) => setViewport(vp),
  });

  const groups = useRoadmapStore((s) => s.groups);
  const items = useRoadmapStore((s) => s.items);
  const scopeItemId = useRoadmapStore((s) => s.scopeItemId);

  const scopedItemIds = useMemo(() => {
    if (scopeItemId === null) return new Set(items.map((i) => i.id));
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
    return ids;
  }, [items, scopeItemId]);

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const { x: tx, y: ty, zoom } = viewport;
  const toScreen = (fx: number, fy: number) => ({
    sx: fx * zoom + tx,
    sy: fy * zoom + ty,
  });

  const PADDING = 30;

  const groupRects = groups
    .map((group) => {
      const memberItems = group.itemIds
        .filter((id) => scopedItemIds.has(id))
        .map((id) => itemMap.get(id))
        .filter(Boolean);
      if (memberItems.length === 0) return null;

      const NODE_W = 220;
      const NODE_H = 100;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const item of memberItems) {
        minX = Math.min(minX, item!.position.x);
        minY = Math.min(minY, item!.position.y);
        maxX = Math.max(maxX, item!.position.x + NODE_W);
        maxY = Math.max(maxY, item!.position.y + NODE_H);
      }

      const topLeft = toScreen(minX - PADDING, minY - PADDING);
      const bottomRight = toScreen(maxX + PADDING, maxY + PADDING);
      const color = GROUP_COLORS[group.colorIndex % GROUP_COLORS.length];

      return { group, topLeft, bottomRight, color };
    })
    .filter(Boolean);

  if (groupRects.length === 0) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: -1,
      }}
    >
      {groupRects.map((r) => {
        const w = r!.bottomRight.sx - r!.topLeft.sx;
        const h = r!.bottomRight.sy - r!.topLeft.sy;
        return (
          <g key={r!.group.id}>
            <rect
              x={r!.topLeft.sx}
              y={r!.topLeft.sy}
              width={w}
              height={h}
              fill={r!.color.bg}
              stroke={r!.color.border}
              strokeWidth="1.5"
              rx="8"
              ry="8"
              opacity="0.9"
            />
            <text
              x={r!.topLeft.sx + 8}
              y={r!.topLeft.sy + 16}
              fill={r!.color.border}
              fontSize="12"
              fontWeight="600"
              fontFamily="sans-serif"
            >
              {r!.group.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function MultiSelectBar() {
  const selectedNodeIds = useRoadmapStore((s) => s.selectedNodeIds);
  const setSelectedNodeIds = useRoadmapStore((s) => s.setSelectedNodeIds);
  const items = useRoadmapStore((s) => s.items);
  const groups = useRoadmapStore((s) => s.groups);
  const batchUpdatePositions = useRoadmapStore((s) => s.batchUpdatePositions);
  const addGroup = useRoadmapStore((s) => s.addGroup);
  const deleteGroup = useRoadmapStore((s) => s.deleteGroup);
  const updateGroup = useRoadmapStore((s) => s.updateGroup);
  const deleteItem = useRoadmapStore((s) => s.deleteItem);
  const [groupInput, setGroupInput] = useState<string | null>(null);
  const [colorPicker, setColorPicker] = useState<string | null>(null); // group id being edited

  const selectedItems = useMemo(
    () => {
      const idSet = new Set(selectedNodeIds);
      return items.filter((i) => idSet.has(i.id));
    },
    [items, selectedNodeIds]
  );

  // Find if selected nodes belong to an existing group
  const matchingGroup = useMemo(() => {
    if (selectedNodeIds.length < 2) return null;
    const selectedSet = new Set(selectedNodeIds);
    return groups.find((g) => g.itemIds.every((id) => selectedSet.has(id)) && g.itemIds.length === selectedNodeIds.length) ?? null;
  }, [groups, selectedNodeIds]);

  const alignSelectedH = useCallback(() => {
    const sorted = [...selectedItems].sort((a, b) => a.position.x - b.position.x);
    const avgY = sorted.reduce((sum, item) => sum + item.position.y, 0) / sorted.length;
    batchUpdatePositions(
      sorted.map((item, i) => ({ id: item.id, position: { x: i * 280, y: avgY } }))
    );
  }, [selectedItems, batchUpdatePositions]);

  const alignSelectedV = useCallback(() => {
    const sorted = [...selectedItems].sort((a, b) => a.position.y - b.position.y);
    const avgX = sorted.reduce((sum, item) => sum + item.position.x, 0) / sorted.length;
    batchUpdatePositions(
      sorted.map((item, i) => ({ id: item.id, position: { x: avgX, y: i * 150 } }))
    );
  }, [selectedItems, batchUpdatePositions]);

  const handleGroup = useCallback(() => {
    if (groupInput !== null && groupInput.trim()) {
      addGroup(groupInput.trim(), selectedNodeIds);
      setGroupInput(null);
    }
  }, [groupInput, addGroup, selectedNodeIds]);

  const handleUngroup = useCallback(() => {
    if (matchingGroup) {
      deleteGroup(matchingGroup.id);
    }
  }, [matchingGroup, deleteGroup]);

  const handleDelete = useCallback(() => {
    const ids = [...selectedNodeIds];
    for (const id of ids) {
      deleteItem(id);
    }
    setSelectedNodeIds([]);
  }, [selectedNodeIds, deleteItem, setSelectedNodeIds]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (selectedNodeIds.length < 2) return;
      // Ignore if typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'g') {
        e.preventDefault();
        if (matchingGroup) {
          handleUngroup();
        } else {
          setGroupInput('');
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!isMod) {
          e.preventDefault();
          handleDelete();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeIds, matchingGroup, handleUngroup, handleDelete]);

  if (selectedNodeIds.length < 2) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-white rounded-lg shadow-md border border-gray-200 px-3 py-2">
      <span className="text-xs font-medium text-gray-500">{selectedNodeIds.length} selected</span>
      <div className="w-px h-5 bg-gray-200" />
      <button
        onClick={alignSelectedH}
        className="px-2 py-1 text-xs font-medium rounded hover:bg-gray-100 text-gray-700 transition-colors"
        title="Align horizontally"
      >
        Align H
      </button>
      <button
        onClick={alignSelectedV}
        className="px-2 py-1 text-xs font-medium rounded hover:bg-gray-100 text-gray-700 transition-colors"
        title="Align vertically"
      >
        Align V
      </button>
      <div className="w-px h-5 bg-gray-200" />

      {matchingGroup ? (
        <>
          {/* Color picker for existing group */}
          <div className="relative">
            <button
              onClick={() => setColorPicker(colorPicker ? null : matchingGroup.id)}
              className="px-2 py-1 text-xs font-medium rounded hover:bg-gray-100 text-gray-700 transition-colors flex items-center gap-1"
              title="Change group color"
            >
              <span
                className="w-3 h-3 rounded-full border border-gray-300"
                style={{ backgroundColor: GROUP_COLORS[matchingGroup.colorIndex % GROUP_COLORS.length].border }}
              />
              Color
            </button>
            {colorPicker === matchingGroup.id && (
              <div className="absolute top-full mt-1 left-0 bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex gap-1 z-50">
                {GROUP_COLORS.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => { updateGroup(matchingGroup.id, { colorIndex: i }); setColorPicker(null); }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${matchingGroup.colorIndex === i ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c.border }}
                    title={c.label}
                  />
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleUngroup}
            className="px-2 py-1 text-xs font-medium rounded hover:bg-orange-50 text-orange-600 transition-colors"
            title="Ungroup (⌘G)"
          >
            Ungroup
          </button>
        </>
      ) : groupInput === null ? (
        <button
          onClick={() => setGroupInput('')}
          className="px-2 py-1 text-xs font-medium rounded hover:bg-indigo-50 text-indigo-600 transition-colors"
          title="Group selected (⌘G)"
        >
          Group
        </button>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); handleGroup(); }}
          className="flex items-center gap-1"
        >
          <input
            autoFocus
            value={groupInput}
            onChange={(e) => setGroupInput(e.target.value)}
            placeholder="Group label…"
            className="w-28 px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-indigo-400"
            onKeyDown={(e) => { if (e.key === 'Escape') setGroupInput(null); }}
          />
          <button
            type="submit"
            disabled={!groupInput.trim()}
            className="px-1.5 py-0.5 text-xs font-medium rounded bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 transition-colors"
          >
            ✓
          </button>
        </form>
      )}
      <div className="w-px h-5 bg-gray-200" />
      <button
        onClick={handleDelete}
        className="px-2 py-1 text-xs font-medium rounded hover:bg-red-50 text-red-600 transition-colors"
        title="Delete selected (⌫)"
      >
        Delete
      </button>
    </div>
  );
}

export function CanvasView() {
  const items = useRoadmapStore((s) => s.items);
  const connections = useRoadmapStore((s) => s.connections);
  const updateItemPosition = useRoadmapStore((s) => s.updateItemPosition);
  const batchUpdatePositions = useRoadmapStore((s) => s.batchUpdatePositions);
  const addConnection = useRoadmapStore((s) => s.addConnection);
  const removeConnection = useRoadmapStore((s) => s.removeConnection);
  const updateConnectionType = useRoadmapStore((s) => s.updateConnectionType);
  const selectItem = useRoadmapStore((s) => s.selectItem);
  const selectedItemId = useRoadmapStore((s) => s.selectedItemId);
  const scopeItemId = useRoadmapStore((s) => s.scopeItemId);
  const setScopeItem = useRoadmapStore((s) => s.setScopeItem);
  const selectedNodeIds = useRoadmapStore((s) => s.selectedNodeIds);
  const setSelectedNodeIds = useRoadmapStore((s) => s.setSelectedNodeIds);
  const searchQuery = useRoadmapStore((s) => s.searchQuery);

  const [selectionMode, setSelectionMode] = useState(false);
  const [focusedEdgeId, setFocusedEdgeId] = useState<string | null>(null);
  const connectingFrom = useRoadmapStore((s) => s.connectingFrom);
  const connectingFromNodeId = connectingFrom?.nodeId ?? null;
  const setConnectingFromNode = useRoadmapStore((s) => s.setConnectingFromNode);

  const scopedItems = useMemo(() => {
    if (scopeItemId === null) {
      // Show all items when no scope selected
      return items;
    }
    // BFS to collect all descendants of scoped item
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

  const scopedItemIds = useMemo(() => new Set(scopedItems.map((i) => i.id)), [scopedItems]);

  const nodes: Node[] = useMemo(
    () => {
      const lowerQuery = searchQuery?.toLowerCase() ?? '';

      // When an edge is focused, find its source & target to highlight
      const focusedConn = focusedEdgeId
        ? connections.find((c) => c.id === focusedEdgeId)
        : null;
      const focusedNodeIds = focusedConn
        ? new Set([focusedConn.sourceId, focusedConn.targetId])
        : null;

      return scopedItems.map((item) => {
        const matches = !lowerQuery ||
          item.title.toLowerCase().includes(lowerQuery) ||
          (item.description ?? '').toLowerCase().includes(lowerQuery);

        const dimForSearch = lowerQuery && !matches;
        const dimForEdge = focusedNodeIds && !focusedNodeIds.has(item.id);

        return {
          id: item.id,
          type: 'roadmapItem',
          position: item.position,
          data: { item },
          selected: item.id === selectedItemId || selectedNodeIds.includes(item.id),
          style: dimForSearch || dimForEdge ? { opacity: 0.2, transition: 'opacity 0.15s' } : { opacity: 1, transition: 'opacity 0.15s' },
        };
      });
    },
    [scopedItems, selectedItemId, selectedNodeIds, searchQuery, focusedEdgeId, connections]
  );

  const edges: Edge[] = useMemo(() => {
    const itemMap = new Map(items.map((item) => [item.id, item]));
    const scopedConnections = connections.filter(
      (c) => scopedItemIds.has(c.sourceId) && scopedItemIds.has(c.targetId)
    );

    return scopedConnections.map((conn) => {
      const source = itemMap.get(conn.sourceId);
      const target = itemMap.get(conn.targetId);

      let sourceHandle = 'source-right';
      let targetHandle = 'target-left';

      if (source && target) {
        // Parent→child connections always route bottom→top (structural hierarchy)
        const isParentChild = target.parentId === conn.sourceId;
        if (isParentChild) {
          sourceHandle = 'source-bottom';
          targetHandle = 'target-top';
        } else {
          const dx = target.position.x - source.position.x;
          const dy = target.position.y - source.position.y;

          if (Math.abs(dy) > Math.abs(dx)) {
            if (dy > 0) {
              sourceHandle = 'source-bottom';
              targetHandle = 'target-top';
            } else {
              sourceHandle = 'source-top';
              targetHandle = 'target-bottom';
            }
          } else {
            if (dx > 0) {
              sourceHandle = 'source-right';
              targetHandle = 'target-left';
            } else {
              sourceHandle = 'source-left';
              targetHandle = 'target-right';
            }
          }
        }
      }

      const connType = conn.type ?? 'direct';
      const isBlocking = connType === 'blocking';
      const isDirect = connType === 'direct';
      const isIndirect = connType === 'indirect';

      const isFocused = focusedEdgeId === conn.id;
      const isDimmed = focusedEdgeId !== null && !isFocused;
      const baseStroke = isBlocking ? '#ef4444' : isDirect ? '#6366f1' : '#94a3b8';
      const strokeColor = isDimmed ? '#d1d5db' : baseStroke;

      return {
        id: conn.id,
        source: conn.sourceId,
        target: conn.targetId,
        sourceHandle,
        targetHandle,
        data: { type: connType, connectionId: conn.id },
        label: isBlocking ? '🚫 blocks' : conn.label,
        labelStyle: isBlocking
          ? { fill: isDimmed ? '#d1d5db' : '#ef4444', fontWeight: 600, fontSize: 11 }
          : undefined,
        labelBgStyle: isBlocking && !isDimmed ? { fill: '#fef2f2', stroke: '#fecaca' } : undefined,
        type: 'smoothstep',
        animated: false,
        interactionWidth: 20,
        style: {
          stroke: strokeColor,
          strokeWidth: isFocused ? 3.5 : isBlocking ? 2.5 : 2,
          strokeDasharray: isIndirect ? '6 4' : undefined,
          opacity: isDimmed ? 0.2 : 1,
          transition: 'opacity 0.15s, stroke 0.15s',
          cursor: !isBlocking ? 'pointer' : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
        },
      };
    });
  }, [connections, items, scopedItemIds, focusedEdgeId]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // Apply changes locally for React Flow rendering
      const updated = applyNodeChanges(changes, nodes);

      // Persist position changes to store
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          updateItemPosition(change.id, change.position);
        }
      }

      return updated;
    },
    [nodes, updateItemPosition]
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      if (params.source && params.target) {
        addConnection(params.source, params.target, undefined, 'direct');
      }
    },
    [addConnection]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      deletedEdges.forEach((e) => {
        // Blocking connections can only be removed by the source node's owner.
        // If the current selection includes the source, allow deletion.
        // If the edge is blocking and the source is NOT in the current selection, skip.
        if (e.data?.type === 'blocking' && !selectedNodeIds.includes(e.source)) return;
        removeConnection(e.id);
      });
    },
    [removeConnection, selectedNodeIds]
  );

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      // Single click: focus/highlight only
      setFocusedEdgeId((prev) => (prev === edge.id ? null : edge.id));
    },
    []
  );

  const onEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      const connType = edge.data?.type as string | undefined;
      if (connType === 'direct' || connType === 'indirect') {
        updateConnectionType(edge.id, connType === 'direct' ? 'indirect' : 'direct');
      }
    },
    [updateConnectionType]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setFocusedEdgeId(null);
      // Without modifier key, clear multi-selection and select only this node
      const isMultiSelect = event.metaKey || event.ctrlKey;
      if (!isMultiSelect) {
        setSelectedNodeIds([node.id]);
      }
      selectItem(node.id);
    },
    [selectItem, setSelectedNodeIds]
  );

  const onPaneClick = useCallback(() => {
    selectItem(null);
    setSelectedNodeIds([]);
    setFocusedEdgeId(null);
  }, [selectItem, setSelectedNodeIds]);

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      setSelectedNodeIds(selectedNodes.map((n) => n.id));
    },
    [setSelectedNodeIds]
  );

  // Deselect when pressing Escape, toggle selection mode with S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        if (connectingFromNodeId) {
          setConnectingFromNode(null);
        } else if (selectionMode) {
          setSelectionMode(false);
        } else {
          selectItem(null);
          setSelectedNodeIds([]);
          setFocusedEdgeId(null);
        }
      }
      // Delete focused edge
      if ((e.key === 'Delete' || e.key === 'Backspace') && focusedEdgeId) {
        const conn = connections.find((c) => c.id === focusedEdgeId);
        if (conn) {
          removeConnection(focusedEdgeId);
          setFocusedEdgeId(null);
        }
      }
      if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
        setSelectionMode((s) => !s);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectItem, setSelectedNodeIds, selectionMode, connectingFromNodeId, setConnectingFromNode, focusedEdgeId, connections, removeConnection]);

  const alignHorizontally = useCallback(() => {
    const sorted = [...scopedItems].sort((a, b) => a.position.x - b.position.x);
    const startY =
      sorted.length > 0
        ? sorted.reduce((sum, item) => sum + item.position.y, 0) / sorted.length
        : 200;
    batchUpdatePositions(
      sorted.map((item, i) => ({ id: item.id, position: { x: i * 280, y: startY } }))
    );
  }, [scopedItems, batchUpdatePositions]);

  const alignVertically = useCallback(() => {
    const sorted = [...scopedItems].sort((a, b) => a.position.y - b.position.y);
    const startX =
      sorted.length > 0
        ? sorted.reduce((sum, item) => sum + item.position.x, 0) / sorted.length
        : 300;
    batchUpdatePositions(
      sorted.map((item, i) => ({ id: item.id, position: { x: startX, y: i * 150 } }))
    );
  }, [scopedItems, batchUpdatePositions]);

  const autoLayout = useCallback(() => {
    const tree = buildHierarchyTree(scopedItems);
    const NODE_W = 280;
    const NODE_H = 150;
    const cols = Math.max(1, Math.ceil(Math.sqrt(tree.length)));
    batchUpdatePositions(
      tree.map((item, idx) => {
        const depth = getItemDepth(scopedItems, item.id);
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        return { id: item.id, position: { x: col * NODE_W + depth * 40, y: row * NODE_H } };
      })
    );
  }, [scopedItems, batchUpdatePositions]);

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const hasChildren = items.some((i) => i.parentId === node.id);
      if (hasChildren) {
        setScopeItem(node.id);
      }
    },
    [items, setScopeItem]
  );

  const [snapEnabled, setSnapEnabled] = useState(false);
  const SNAP_GRID: [number, number] = [20, 20];
  const SNAP_THRESHOLD = 10;

  const [snapLines, setSnapLines] = useState<{
    horizontal: Array<{ y: number; x1: number; x2: number }>;
    vertical: Array<{ x: number; y1: number; y2: number }>;
  }>({ horizontal: [], vertical: [] });

  const onNodeDrag = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (!snapEnabled) return;
      const NODE_W = 220;
      const NODE_H = 100;
      const px = node.position.x;
      const py = node.position.y;
      const pcx = px + NODE_W / 2;
      const pcy = py + NODE_H / 2;

      const hLines: Array<{ y: number; x1: number; x2: number }> = [];
      const vLines: Array<{ x: number; y1: number; y2: number }> = [];

      for (const item of scopedItems) {
        if (item.id === node.id) continue;
        const ix = item.position.x;
        const iy = item.position.y;
        const icx = ix + NODE_W / 2;
        const icy = iy + NODE_H / 2;

        // Left edge alignment
        if (Math.abs(px - ix) < SNAP_THRESHOLD) {
          vLines.push({ x: ix, y1: Math.min(py, iy) - 20, y2: Math.max(py + NODE_H, iy + NODE_H) + 20 });
        }
        // Center X alignment
        if (Math.abs(pcx - icx) < SNAP_THRESHOLD) {
          vLines.push({ x: icx, y1: Math.min(py, iy) - 20, y2: Math.max(py + NODE_H, iy + NODE_H) + 20 });
        }
        // Right edge alignment
        if (Math.abs(px + NODE_W - (ix + NODE_W)) < SNAP_THRESHOLD) {
          vLines.push({ x: ix + NODE_W, y1: Math.min(py, iy) - 20, y2: Math.max(py + NODE_H, iy + NODE_H) + 20 });
        }

        // Top edge alignment
        if (Math.abs(py - iy) < SNAP_THRESHOLD) {
          hLines.push({ y: iy, x1: Math.min(px, ix) - 20, x2: Math.max(px + NODE_W, ix + NODE_W) + 20 });
        }
        // Center Y alignment
        if (Math.abs(pcy - icy) < SNAP_THRESHOLD) {
          hLines.push({ y: icy, x1: Math.min(px, ix) - 20, x2: Math.max(px + NODE_W, ix + NODE_W) + 20 });
        }
        // Bottom edge alignment
        if (Math.abs(py + NODE_H - (iy + NODE_H)) < SNAP_THRESHOLD) {
          hLines.push({ y: iy + NODE_H, x1: Math.min(px, ix) - 20, x2: Math.max(px + NODE_W, ix + NODE_W) + 20 });
        }
      }

      setSnapLines({ horizontal: hLines, vertical: vLines });
    },
    [snapEnabled, scopedItems]
  );

  const onNodeDragStop = useCallback((_event: any, _node: any, draggedNodes: any[]) => {
    setSnapLines({ horizontal: [], vertical: [] });
    // Persist final positions to the API in a single batch call
    batchUpdatePositions(
      draggedNodes.map((n: any) => ({ id: n.id, position: n.position }))
    );
  }, [batchUpdatePositions]);

  const [toolbarVisible, setToolbarVisible] = useState(true);

  return (
    <div className="flex-1 h-full relative">
      <ReactFlow
        nodes={nodes}
        snapToGrid={snapEnabled}
        snapGrid={SNAP_GRID}
        edges={edges}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onEdgeClick={onEdgeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        onSelectionChange={onSelectionChange}
        selectionOnDrag={selectionMode}
        panOnDrag={!selectionMode}
        selectionMode={selectionMode ? SelectionMode.Partial : undefined}
        multiSelectionKeyCode={['Meta', 'Control']}
        connectionMode={ConnectionMode.Strict}
        connectionLineStyle={{
          stroke: '#6366f1',
          strokeWidth: 2,
        }}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="#e5e7eb" />
        <Controls />
        <GroupOverlay />
        {snapEnabled && (snapLines.horizontal.length > 0 || snapLines.vertical.length > 0) && (
          <SnapGuidesOverlay snapLines={snapLines} />
        )}
      </ReactFlow>
      <MultiSelectBar />
      <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-1">
        <button
          onClick={() => setToolbarVisible((v) => !v)}
          className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-md border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
          title={toolbarVisible ? 'Hide toolbar' : 'Show toolbar'}
        >
          {toolbarVisible ? '✕' : '⚙'}
        </button>
        {toolbarVisible && (
          <div className="flex flex-col gap-1 bg-white rounded-lg shadow-md border border-gray-200 p-1.5">
            <ToolbarButton
              onClick={alignHorizontally}
              label="Align Horizontally"
              description="Align all nodes in a horizontal row"
            >
              ⬌
            </ToolbarButton>
            <ToolbarButton
              onClick={alignVertically}
              label="Align Vertically"
              description="Align all nodes in a vertical column"
            >
              ⬍
            </ToolbarButton>
            <ToolbarButton
              onClick={autoLayout}
              label="Auto Layout"
              description="Arrange nodes in a grid"
            >
              ⊞
            </ToolbarButton>
            <div className="h-px bg-gray-200 my-0.5" />
            <ToolbarButton
              onClick={() => setSnapEnabled((s) => !s)}
              label="Snap to Grid"
              description="Snap nodes to 20px grid while dragging"
              active={snapEnabled}
            >
              ⊹
            </ToolbarButton>
            <div className="h-px bg-gray-200 my-0.5" />
            <ToolbarButton
              onClick={() => setSelectionMode((s) => !s)}
              label="Selection Mode"
              description="Drag to select multiple nodes (S)"
              active={selectionMode}
            >
              ⛶
            </ToolbarButton>
          </div>
        )}
      </div>
      {/* Connecting-from banner */}
      {connectingFrom && (
        <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 ${
          connectingFrom.type === 'blocking' ? 'bg-red-600' : connectingFrom.type === 'indirect' ? 'bg-gray-600' : 'bg-indigo-600'
        }`}>
          <span>
            {connectingFrom.type === 'blocking' ? '🚫' : connectingFrom.type === 'indirect' ? '↗' : '🔗'}
            {' '}Creating <strong>{connectingFrom.type}</strong> connection — click target node
          </span>
          <button
            onClick={() => setConnectingFromNode(null)}
            className="text-xs bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors"
          >
            Cancel (Esc)
          </button>
        </div>
      )}
    </div>
  );
}
