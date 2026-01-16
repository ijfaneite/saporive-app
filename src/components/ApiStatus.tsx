"use client";

import { useApiStatus } from '@/hooks/use-api-status';
import { Wifi, WifiOff } from 'lucide-react';

export function ApiStatus() {
  const isOnline = useApiStatus();

  return (
    <>
      {isOnline ? (
        <Wifi className="h-5 w-5 text-green-400" />
      ) : (
        <WifiOff className="h-5 w-5 text-red-500" />
      )}
    </>
  );
}
