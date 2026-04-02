import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import App from './App.tsx'
import { resolveStorageMode, setStorageAdapter } from './lib/storageAdapter'
import { LocalStorageAdapter } from './lib/storage'
import { ApiStorageAdapter } from './lib/api'
import { useRoadmapStore } from './store/roadmapStore'
import { SignInPage } from './pages/SignInPage'
import { SignUpPage } from './pages/SignUpPage'
import { AuthGuard } from './components/auth/AuthGuard'
import { TokenSync } from './components/auth/TokenSync'

function AppWithData() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
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

function AuthenticatedApp() {
  return (
    <AuthGuard>
      <AppWithData />
    </AuthGuard>
  );
}

function Root() {
  const [storageMode, setStorageModeState] = useState<'local' | 'api' | null>(null);

  useEffect(() => {
    async function init() {
      const mode = await resolveStorageMode();
      if (mode === 'api') {
        setStorageAdapter(new ApiStorageAdapter());
      } else {
        setStorageAdapter(new LocalStorageAdapter());
      }
      setStorageModeState(mode);
    }
    init();
  }, []);

  if (!storageMode) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // localStorage mode: no auth needed (demo / GitHub Pages)
  if (storageMode === 'local') {
    return <AppWithData />;
  }

  // API mode: Clerk auth required
  const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!clerkPubKey) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center text-red-600">
          <p className="font-semibold">Missing VITE_CLERK_PUBLISHABLE_KEY</p>
          <p className="text-sm text-gray-500 mt-2">Set this env var to enable authentication in API mode.</p>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <TokenSync />
      <BrowserRouter>
        <Routes>
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />
          <Route path="/*" element={<AuthenticatedApp />} />
        </Routes>
      </BrowserRouter>
    </ClerkProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
