"use client";

import { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/lib/config';

export function useApiStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/docs`, { method: 'HEAD', mode: 'cors' });
        // The API seems to not support HEAD, so we'll just check if the fetch resolves
        setIsOnline(true);
      } catch (error) {
        setIsOnline(false);
      }
    };

    checkStatus();
    const intervalId = setInterval(checkStatus, 30000); // Check every 30 seconds

    return () => clearInterval(intervalId);
  }, []);

  return isOnline;
}
