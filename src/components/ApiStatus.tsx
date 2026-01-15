"use client";

import { useState, useEffect } from 'react';
import { useApiStatus } from '@/hooks/use-api-status';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function ApiStatus() {
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const isOnline = useApiStatus();

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(format(now, 'HH:mm:ss'));
      setCurrentDate(format(now, 'dd/MM/yyyy'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs text-primary-foreground">
      <div className="flex flex-col items-end">
        <span>{currentDate}</span>
        <span>{currentTime}</span>
      </div>
      <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} title={isOnline ? 'Online' : 'Offline'}></div>
    </div>
  );
}
