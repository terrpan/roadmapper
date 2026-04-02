import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UserButton, OrganizationSwitcher } from '@clerk/react';
import type { ViewMode } from '../../types';
import { ImportDataSchema } from '../../types';
import { useRoadmapStore } from '../../store/roadmapStore';
import { exportCanvasToPdf } from '../../lib/exportPdf';
import { getStorageAdapter } from '../../lib/storageAdapter';

export function Header() {
  const viewMode = useRoadmapStore((s) => s.viewMode);
  const setViewMode = useRoadmapStore((s) => s.setViewMode);
  const openCreateDialog = useRoadmapStore((s) => s.openCreateDialog);
  const scopeItemId = useRoadmapStore((s) => s.scopeItemId);
  const setScopeItem = useRoadmapStore((s) => s.setScopeItem);
  const items = useRoadmapStore((s) => s.items);
  const searchQuery = useRoadmapStore((s) => s.searchQuery);
  const setSearchQuery = useRoadmapStore((s) => s.setSearchQuery);
  const importData = useRoadmapStore((s) => s.importData);

  const [searchOpen, setSearchOpen] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Close import menu on outside click
  useEffect(() => {
    if (!importMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) {
        setImportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [importMenuOpen]);

  const handleNewItem = () => {
    openCreateDialog();
  };

  const handleFileImport = useCallback(
    (mode: 'replace' | 'merge') => {
      fileInputRef.current?.setAttribute('data-mode', mode);
      fileInputRef.current?.click();
      setImportMenuOpen(false);
    },
    []
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const mode = (e.target.getAttribute('data-mode') as 'replace' | 'merge') || 'merge';
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const raw = JSON.parse(ev.target?.result as string);
          const result = ImportDataSchema.safeParse(raw);
          if (!result.success) {
            const messages = result.error.issues.map((i) => i.message).join('\n');
            alert(`Invalid roadmap JSON:\n${messages}`);
            return;
          }
          importData(result.data, mode);
        } catch {
          alert('Failed to parse JSON file.');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [importData]
  );

  const handleLoadSample = useCallback(
    async (mode: 'replace' | 'merge') => {
      setImportMenuOpen(false);
      try {
        const resp = await fetch(`${import.meta.env.BASE_URL}sample-roadmap.json`);
        const raw = await resp.json();
        const result = ImportDataSchema.safeParse(raw);
        if (!result.success) {
          alert('Invalid sample roadmap data.');
          return;
        }
        importData(result.data, mode);
      } catch {
        alert('Failed to load sample roadmap.');
      }
    },
    [importData]
  );

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
        {getStorageAdapter().mode === 'api' && (
          <>
            <OrganizationSwitcher
              hidePersonal={true}
              afterSelectOrganizationUrl="/"
              afterCreateOrganizationUrl="/"
            />
            <UserButton />
            <div className="w-px h-6 bg-gray-200" />
          </>
        )}
        <div
          className={`flex items-center rounded-lg border transition-all ${
            searchQuery
              ? 'border-indigo-300 bg-indigo-50'
              : 'border-gray-300'
          } ${searchOpen ? 'w-64' : 'w-auto'}`}
        >
          <button
            onClick={() => {
              if (searchOpen) {
                setSearchOpen(false);
                setSearchQuery('');
              } else {
                setSearchOpen(true);
              }
            }}
            className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            🔍
          </button>
          {searchOpen && (
            <div className="relative flex-1">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchOpen(false);
                    setSearchQuery('');
                  }
                }}
                placeholder="Search items…"
                className="w-full bg-transparent py-1.5 pr-6 text-sm outline-none placeholder-gray-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
        {viewMode === 'canvas' && (
          <button
            onClick={exportCanvasToPdf}
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            📄 Export PDF
          </button>
        )}
        {/* Import dropdown */}
        <div className="relative" ref={importMenuRef}>
          <button
            onClick={() => setImportMenuOpen((v) => !v)}
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            📥 Import
          </button>
          {importMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">From file</div>
              <button
                onClick={() => handleFileImport('replace')}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <span>📂</span> Import JSON (replace all)
              </button>
              <button
                onClick={() => handleFileImport('merge')}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <span>➕</span> Import JSON (merge)
              </button>
              <div className="border-t border-gray-100 my-1" />
              <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Sample data</div>
              <button
                onClick={() => handleLoadSample('replace')}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <span>🗺️</span> Load sample (replace all)
              </button>
              <button
                onClick={() => handleLoadSample('merge')}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <span>🗺️</span> Load sample (merge)
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
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
