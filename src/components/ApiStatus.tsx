"use client";

import { useApiStatus } from '@/hooks/use-api-status';

export function ApiStatus() {
  const isOnline = useApiStatus();

  return (
    <div className="flex items-center gap-1.5 text-xs">
        <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-500'}`} />
        <span className="text-primary-foreground/90">
            Conexión: <span className="font-semibold">{isOnline ? 'Conectado' : 'Desconectado'}</span>
        </span>
    </div>
  );
}
