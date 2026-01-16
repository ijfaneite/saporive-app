"use client";

import Image from 'next/image';
import { useAuth } from '@/lib/auth';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { User, Building2 } from 'lucide-react';
import { ApiStatus } from './ApiStatus';

export function Header() {
  const { selectedEmpresa, user, asesor } = useAuth();
  const logo = PlaceHolderImages.find(img => img.id === 'logo');

  return (
    <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-3 bg-primary text-primary-foreground shadow-md font-headline">
      {/* Left side */}
      <div className="flex items-center gap-2">
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
      
      {/* Center */}
      <div className="text-center font-semibold text-base">
        {asesor?.Asesor || ''}
      </div>

      {/* Right side */}
      <div className="flex justify-end items-center gap-3">
        <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <User className="w-4 h-4" />
              <span className="truncate">{user?.username || 'Usuario'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
                <Building2 className="w-4 h-4" />
                <span className="truncate">{selectedEmpresa?.RazonSocial || 'Seleccione Empresa'}</span>
            </div>
        </div>
        <ApiStatus />
      </div>
    </header>
  );
}
