"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Asesor } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
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
  const { token, setAsesor, asesor: currentAsesor } = useAuth();
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [selectedAsesorId, setSelectedAsesorId] = useState<string | undefined>(currentAsesor?.idAsesor);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAsesores = async () => {
      if (!token) return;
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}${API_ROUTES.asesores}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch asesores');
        const data: Asesor[] = await response.json();
        setAsesores(data);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo cargar la lista de asesores.",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchAsesores();
  }, [token, toast]);

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
        {isLoading ? (
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
        <Button onClick={handleSave} className="w-full" disabled={!selectedAsesorId || isLoading}>Guardar Asesor</Button>
    </div>
  );
}
