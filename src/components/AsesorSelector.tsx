"use client";

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Asesor } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';

interface AsesorSelectorProps {
    onAsesorSelected?: () => void;
}

export function AsesorSelector({ onAsesorSelected }: AsesorSelectorProps) {
  const { setAsesor, asesor: currentAsesor, asesores, isSyncing } = useAuth();
  const [selectedAsesorId, setSelectedAsesorId] = useState<string | undefined>(currentAsesor?.idAsesor);
  const { toast } = useToast();

  const handleSave = () => {
    const selected = asesores.find(a => a.idAsesor === selectedAsesorId);
    if (selected) {
      setAsesor(selected);
      toast({
        title: "Asesor guardado",
        description: `El asesor por defecto es ahora ${selected.Asesor}.`,
      });
      if (onAsesorSelected) {
        onAsesorSelected();
      }
    } else {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Por favor, seleccione un asesor válido.",
        });
    }
  };

  return (
    <div className="space-y-4">
        <h3 className="font-semibold text-lg font-headline">Seleccionar Asesor</h3>
        {isSyncing ? (
            <div className="flex items-center justify-center h-24">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        ) : (
            <div className="flex items-center gap-2">
                 <Select onValueChange={setSelectedAsesorId} defaultValue={selectedAsesorId}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccione un asesor..." />
                    </SelectTrigger>
                    <SelectContent>
                        {asesores.map((asesor) => (
                        <SelectItem key={asesor.idAsesor} value={asesor.idAsesor}>
                            {asesor.Asesor}
                        </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        )}
        <Button onClick={handleSave} className="w-full" disabled={!selectedAsesorId || isSyncing}>Guardar Asesor</Button>
    </div>
  );
}
