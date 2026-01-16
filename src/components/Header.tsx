"use client";

import Image from 'next/image';
import { useAuth } from '@/lib/auth';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { ApiStatus } from './ApiStatus';

export function Header() {
  const { user, selectedEmpresa } = useAuth();
  const logo = PlaceHolderImages.find(img => img.id === 'logo');

  return (
    <header className="flex items-center justify-between p-3 bg-primary text-primary-foreground shadow-md font-headline">
      <div className="flex items-center gap-2 w-1/4">
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
      <div className="font-semibold text-center truncate flex-grow text-lg">
        {selectedEmpresa?.nombre || 'Seleccione Empresa'}
      </div>
      <div className="flex items-center justify-end gap-3 text-xs w-1/4">
        <span className='truncate'>{user?.username || 'Usuario'}</span>
        <ApiStatus />
      </div>
    </header>
  );
}
