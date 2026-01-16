"use client";

import Image from 'next/image';
import { useAuth } from '@/lib/auth';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { User, Building2 } from 'lucide-react';
import { ApiStatus } from './ApiStatus';

export function Header() {
  const { selectedEmpresa, user } = useAuth();
  const logo = PlaceHolderImages.find(img => img.id === 'logo');

  return (
    <header className="flex items-center justify-between p-3 bg-primary text-primary-foreground shadow-md font-headline">
      <div className="flex items-center gap-2 shrink-0">
        {logo && (
          <Image
            src={logo.imageUrl}
            alt={logo.description}
            width={40}
            height={40}
            className="rounded-full"
            data-ai-hint={logo.imageHint}
          />
        )}
      </div>
      
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <User className="w-4 h-4" />
          <span>{user?.username || 'Usuario'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
            <Building2 className="w-4 h-4" />
            <span className="truncate">{selectedEmpresa?.RazonSocial || 'Seleccione Empresa'}</span>
        </div>
        <ApiStatus />
      </div>
    </header>
  );
}
