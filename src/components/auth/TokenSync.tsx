import { useEffect } from 'react';
import { useAuth } from '@clerk/react';
import { setTokenProvider } from '../../lib/api';

export function TokenSync() {
  const { getToken } = useAuth();

  useEffect(() => {
    setTokenProvider(() => getToken());
    return () => setTokenProvider(null as unknown as () => Promise<string | null>);
  }, [getToken]);

  return null;
}
