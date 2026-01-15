"use client";

import { AsesorSelector } from './AsesorSelector';
import { useAuth } from '@/lib/auth';

export function AsesorSelectionModal() {
  const { setAsesor, asesor } = useAuth();

  const handleAsesorSelected = () => {
    // The selector component handles setting the asesor in context
  };

  if (asesor) return null;

  return (
    <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-card p-6 rounded-lg shadow-xl w-full max-w-sm">
        <div className="text-center mb-4">
            <h2 className="text-2xl font-bold font-headline text-primary">Bienvenido</h2>
            <p className="text-muted-foreground">Por favor, seleccione su código de asesor para continuar.</p>
        </div>
        <AsesorSelector onAsesorSelected={handleAsesorSelected} />
      </div>
    </div>
  );
}
