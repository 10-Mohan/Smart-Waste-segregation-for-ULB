import { useCallback, useEffect, useState } from 'react';

export default function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const markOffline = useCallback(() => setIsOnline(false), []);
  const markOnline = useCallback(() => setIsOnline(true), []);

  useEffect(() => {
    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);
    window.addEventListener('waste-api-network-error', markOffline);
    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
      window.removeEventListener('waste-api-network-error', markOffline);
    };
  }, [markOffline, markOnline]);

  return { isOnline, markOffline, markOnline };
}