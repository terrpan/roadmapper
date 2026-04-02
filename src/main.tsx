import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { resolveStorageMode, setStorageAdapter } from './lib/storageAdapter'
import { LocalStorageAdapter } from './lib/storage'
import { ApiStorageAdapter } from './lib/api'
import { useRoadmapStore } from './store/roadmapStore'

function Root() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      const mode = await resolveStorageMode();
      if (mode === 'api') {
        setStorageAdapter(new ApiStorageAdapter());
      } else {
        setStorageAdapter(new LocalStorageAdapter());
      }
      await useRoadmapStore.getState().initializeFromStorage();
      setReady(true);
    }
    init();
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
