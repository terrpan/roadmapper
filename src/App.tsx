import { ReactFlowProvider } from '@xyflow/react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import NavigationPane from './components/layout/NavigationPane';
import { CanvasView } from './components/canvas/CanvasView';
import { KanbanView } from './components/kanban/KanbanView';
import GanttView from './components/gantt/GanttView';
import { ItemDialog } from './components/shared/ItemDialog';
import { useRoadmapStore } from './store/roadmapStore';

export default function App() {
  const viewMode = useRoadmapStore((s) => s.viewMode);
  const items = useRoadmapStore((s) => s.items);

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <NavigationPane />
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          {items.length === 0 ? (
            <EmptyState />
          ) : viewMode === 'canvas' ? (
            <ReactFlowProvider>
              <CanvasView />
            </ReactFlowProvider>
          ) : viewMode === 'kanban' ? (
            <KanbanView />
          ) : (
            <GanttView />
          )}
        </main>
        <Sidebar />
      </div>
      <ItemDialog />
    </div>
  );
}

function EmptyState() {
  const openCreateDialog = useRoadmapStore((s) => s.openCreateDialog);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4">🗺️</div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Your roadmap is empty</h2>
        <p className="text-sm text-gray-500 mb-4">Create your first item to get started</p>
        <button
          onClick={openCreateDialog}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + Create First Item
        </button>
      </div>
    </div>
  );
}
