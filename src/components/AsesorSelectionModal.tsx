"use client";

import React, { useState, useEffect } from 'react';
import { useData } from '@/lib/data-provider';
import { useAuth } from '@/lib/auth';
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

export function AsesorSelectionModal() {
  const { user } = useAuth();
  const { setAsesor, asesores, isSyncing, setEmpresa, empresas, asesor: currentAsesor } = useData();
  const { toast } = useToast();
  
  const isUserAdmin = user?.idRol === 'admin';

  const [selectedAsesorId, setSelectedAsesorId] = useState<string | undefined>(isUserAdmin ? undefined : currentAsesor?.idAsesor);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string | undefined>();

  useEffect(() => {
    // Pre-fill a non-admin user's advisor since it is determined by the system
    if (!isUserAdmin && currentAsesor) {
      setSelectedAsesorId(currentAsesor.idAsesor);
    }
  }, [isUserAdmin, currentAsesor]);

  const canContinue = selectedEmpresaId && (isUserAdmin ? selectedAsesorId : true);

  const handleContinue = () => {
    if (!canContinue) {
        toast({ variant: "destructive", title: "Error", description: "Por favor, seleccione una empresa." });
        return;
    }
    
    const selectedComp = empresas.find(e => e.idEmpresa.toString() === selectedEmpresaId);
    if (!selectedComp) {
        toast({ variant: "destructive", title: "Error", description: "La empresa seleccionada no es válida." });
        return;
    }

    const advisorToSet = isUserAdmin 
        ? asesores.find(a => a.idAsesor === selectedAsesorId)
        : currentAsesor;

    if (!advisorToSet) {
        toast({ variant: "destructive", title: "Error", description: "No se ha podido determinar el asesor." });
        return;
    }

    setEmpresa(selectedComp);
    if (isUserAdmin) {
        setAsesor(advisorToSet);
    }

    toast({
        title: "Configuración guardada",
        description: `Trabajando con ${selectedComp.RazonSocial} como ${advisorToSet.Asesor}.`,
    });
  };

  return (
      <div className="bg-card p-6 rounded-lg shadow-xl w-full max-w-sm space-y-6">
        <div className="text-center">
            <h2 className="text-2xl font-bold font-headline text-primary">Configuración Inicial</h2>
            <p className="text-muted-foreground">Por favor, seleccione los datos para comenzar.</p>
        </div>

        {isSyncing ? (
            <div className="flex items-center justify-center h-36">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2 block">Empresa</label>
              <Select onValueChange={setSelectedEmpresaId} defaultValue={selectedEmpresaId}>
                  <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccione una empresa..." />
                  </SelectTrigger>
                  <SelectContent>
                      {empresas.map((empresa) => (
                      <SelectItem key={empresa.idEmpresa} value={empresa.idEmpresa.toString()}>
                          {empresa.RazonSocial}
                      </SelectItem>
                      ))}
                  </SelectContent>
              </Select>
            </div>
            
            {isUserAdmin && (
              <div>
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2 block">Asesor de Ventas</label>
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
          </div>
        )}

        <Button onClick={handleContinue} className="w-full" disabled={!canContinue || isSyncing}>
          Continuar
        </Button>
      </div>
  );
}
