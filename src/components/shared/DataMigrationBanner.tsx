import { useState, useEffect } from 'react';
import { getStorageAdapter } from '../../lib/storageAdapter';
import { loadFromStorage } from '../../lib/storage';
import type { RoadmapItem, Connection, Group } from '../../types';

interface LocalData {
  items: RoadmapItem[];
  connections: Connection[];
  groups: Group[];
}

export function DataMigrationBanner() {
  const [visible, setVisible] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const adapter = getStorageAdapter();
    if (adapter.mode !== 'api') return;

    const localData = loadFromStorage<LocalData>();
    if (localData && localData.items && localData.items.length > 0) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleMigrate = async () => {
    setMigrating(true);
    setError(null);
    try {
      const localData = loadFromStorage<LocalData>();
      if (!localData) return;

      const adapter = getStorageAdapter();
      await adapter.importData(
        {
          items: localData.items ?? [],
          connections: localData.connections ?? [],
          groups: localData.groups ?? [],
        },
        'merge'
      );

      // Clear localStorage after successful migration
      localStorage.removeItem('roadmapper-data');
      setVisible(false);

      // Reload to pick up migrated data
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setMigrating(false);
    }
  };

  const handleDismiss = () => setVisible(false);

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <span className="text-blue-700">
          📦 Found existing local data ({loadFromStorage<LocalData>()?.items?.length ?? 0} items).
          Would you like to migrate it to the server?
        </span>
        {error && <span className="text-red-600 ml-2">{error}</span>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleMigrate}
          disabled={migrating}
          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
        >
          {migrating ? 'Migrating...' : 'Migrate'}
        </button>
        <button
          onClick={handleDismiss}
          className="px-3 py-1 text-blue-600 hover:text-blue-800 text-xs"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
