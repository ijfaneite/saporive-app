"use client";

import { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/lib/config';
import { safeFetch } from '@/lib/result';

export function useApiStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      // Using HEAD is more efficient as we don't need the body.
      // We are only interested in whether the request succeeds.
      const result = await safeFetch(`${API_BASE_URL}/docs`, { method: 'HEAD', mode: 'cors' });
      setIsOnline(result.success);
    };

    checkStatus();
    const intervalId = setInterval(checkStatus, 30000); // Check every 30 seconds

    return () => clearInterval(intervalId);
  }, []);

  return isOnline;
}
