"use client";

import React, { useState } from 'react';
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

export function EmpresaSelector() {
  const { empresas, setEmpresa, selectedEmpresa } = useAuth();
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string | undefined>(selectedEmpresa?.idEmpresa.toString());
  const { toast } = useToast();

  const handleSave = () => {
    const selected = empresas.find(e => e.idEmpresa.toString() === selectedEmpresaId);
    if (selected) {
      setEmpresa(selected);
      toast({
        title: "Empresa guardada",
        description: `La empresa por defecto es ahora ${selected.RazonSocial}.`,
      });
    } else {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Por favor, seleccione una empresa válida.",
        });
    }
  };

  return (
    <div className="space-y-4">
        <div className="flex items-center gap-2">
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
        <Button onClick={handleSave} className="w-full" disabled={!selectedEmpresaId}>Guardar Empresa</Button>
    </div>
  );
}
