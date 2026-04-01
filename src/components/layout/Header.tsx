import React from 'react';
import type { ViewMode } from '../../types';
import { useRoadmapStore } from '../../store/roadmapStore';
import { exportCanvasToPdf } from '../../lib/exportPdf';

export function Header() {
  const viewMode = useRoadmapStore((s) => s.viewMode);
  const setViewMode = useRoadmapStore((s) => s.setViewMode);
  const openCreateDialog = useRoadmapStore((s) => s.openCreateDialog);
  const scopeItemId = useRoadmapStore((s) => s.scopeItemId);
  const setScopeItem = useRoadmapStore((s) => s.setScopeItem);
  const items = useRoadmapStore((s) => s.items);

  // Build breadcrumb trail
  const breadcrumbs: { id: string; title: string }[] = [];
  let currentId = scopeItemId;
  while (currentId) {
    const item = items.find((i) => i.id === currentId);
    if (item) {
      breadcrumbs.unshift({ id: item.id, title: item.title });
      currentId = item.parentId ?? null;
    } else {
      break;
    }
  }

  const handleNewItem = () => {
    openCreateDialog();
  };

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-gray-800">🗺️ Roadmapper</h1>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <button onClick={() => setScopeItem(null)} className="hover:text-indigo-600">
            All
          </button>
          {breadcrumbs.map((bc) => (
            <React.Fragment key={bc.id}>
              <span className="text-gray-300">/</span>
              <button
                onClick={() => setScopeItem(bc.id)}
                className="hover:text-indigo-600 truncate max-w-32"
              >
                {bc.title}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-0.5">
          {(['canvas', 'kanban', 'gantt'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {mode === 'canvas' ? '🔗 Canvas' : mode === 'kanban' ? '📋 Kanban' : '📊 Gantt'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {viewMode === 'canvas' && (
          <button
            onClick={exportCanvasToPdf}
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            📄 Export PDF
          </button>
        )}
        <button
          onClick={handleNewItem}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + New Item
        </button>
      </div>
    </header>
  );
}
