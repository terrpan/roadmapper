import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnConnect,
  type NodeTypes,
  applyNodeChanges,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRoadmapStore } from '../../store/roadmapStore';
import { ItemNode } from './ItemNode';
import { buildHierarchyTree, getItemDepth } from '../../types';

const nodeTypes: NodeTypes = {
  roadmapItem: ItemNode,
};

export function CanvasView() {
  const items = useRoadmapStore((s) => s.items);
  const connections = useRoadmapStore((s) => s.connections);
  const updateItemPosition = useRoadmapStore((s) => s.updateItemPosition);
  const batchUpdatePositions = useRoadmapStore((s) => s.batchUpdatePositions);
  const addConnection = useRoadmapStore((s) => s.addConnection);
  const selectItem = useRoadmapStore((s) => s.selectItem);
  const selectedItemId = useRoadmapStore((s) => s.selectedItemId);
  const scopeItemId = useRoadmapStore((s) => s.scopeItemId);
  const setScopeItem = useRoadmapStore((s) => s.setScopeItem);

  const scopedItems = useMemo(() => {
    if (scopeItemId === null) {
      return items.filter((i) => !i.parentId);
    }
    return items.filter((i) => i.parentId === scopeItemId);
  }, [items, scopeItemId]);

  const scopedItemIds = useMemo(() => new Set(scopedItems.map((i) => i.id)), [scopedItems]);

  const nodes: Node[] = useMemo(
    () =>
      scopedItems.map((item) => ({
        id: item.id,
        type: 'roadmapItem',
        position: item.position,
        data: { item },
        selected: item.id === selectedItemId,
      })),
    [scopedItems, selectedItemId]
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

      const isDirect = (conn.type ?? 'direct') === 'direct';

      return {
        id: conn.id,
        source: conn.sourceId,
        target: conn.targetId,
        sourceHandle,
        targetHandle,
        label: conn.label,
        type: 'smoothstep',
        animated: isDirect,
        style: {
          stroke: isDirect ? '#6366f1' : '#94a3b8',
          strokeWidth: 2,
          strokeDasharray: isDirect ? undefined : '6 4',
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isDirect ? '#6366f1' : '#94a3b8',
        },
      };
    });
  }, [connections, items, scopedItemIds]);

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
        addConnection(params.source, params.target);
      }
    },
    [addConnection]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectItem(node.id);
    },
    [selectItem]
  );

  const onPaneClick = useCallback(() => {
    selectItem(null);
  }, [selectItem]);

  // Deselect when pressing Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectItem(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectItem]);

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

  const btnClass =
    'px-2 py-1.5 text-xs rounded hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors';

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
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
      </ReactFlow>
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 bg-white rounded-lg shadow-md border border-gray-200 p-1.5">
        <button onClick={alignHorizontally} title="Align Horizontally" className={btnClass}>
          ⬌
        </button>
        <button onClick={alignVertically} title="Align Vertically" className={btnClass}>
          ⬍
        </button>
        <button onClick={autoLayout} title="Auto Layout" className={btnClass}>
          ⊞
        </button>
      </div>
    </div>
  );
}
