"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data-provider';
import { PedidoCreatePayload } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { PedidoForm } from '@/components/PedidoForm';
import { useApiStatus } from '@/hooks/use-api-status';

export default function NuevoPedidoPage() {
  const { token, logout } = useAuth();
  const { selectedEmpresa, addLocalPedido, findAndReserveNextPedidoId } = useData();
  const router = useRouter();
  const { toast } = useToast();
  const isOnline = useApiStatus();

  const [isSaving, setIsSaving] = useState(false);
  const [idPedidoGenerado, setIdPedidoGenerado] = useState<string>('');

  useEffect(() => {
    if (!isOnline) {
        setIdPedidoGenerado("PENDIENTE (OFFLINE)");
    } else {
      setIdPedidoGenerado("Generando ID...");
    }
  }, [isOnline]);

  const handleSavePedido = async (pedidoPayload: PedidoCreatePayload) => {
    setIsSaving(true);
    
    if (!isOnline) {
        try {
            await addLocalPedido({
                idEmpresa: pedidoPayload.idEmpresa,
                totalPedido: pedidoPayload.totalPedido,
                idAsesor: pedidoPayload.idAsesor,
                idCliente: pedidoPayload.idCliente,
                detalles: pedidoPayload.detalles,
            });
            router.push('/pedidos');
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error al guardar localmente",
                description: error instanceof Error ? error.message : "Ocurrió un error inesperado.",
            });
        } finally {
            setIsSaving(false);
        }
        return;
    }

    if (!token || !selectedEmpresa) {
        toast({ variant: "destructive", title: "Error de configuración", description: "No se ha seleccionado una empresa o la sesión ha expirado." });
        setIsSaving(false);
        if (!token) logout();
        return;
    }

    try {
      const reservedId = await findAndReserveNextPedidoId();
      if (!reservedId) {
          throw new Error('No se pudo obtener un ID de pedido válido.');
      }
      
      const finalPayload = { ...pedidoPayload, idPedido: reservedId };

      const response = await fetch(`${API_BASE_URL}${API_ROUTES.pedidos}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(finalPayload),
      });

      if (response.status === 401) {
        toast({ variant: 'destructive', title: 'Sesión expirada', description: 'Inicie sesión de nuevo.' });
        logout();
        setIsSaving(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Error desconocido del servidor.' }));
        throw new Error(errorData.detail || 'No se pudo guardar el pedido.');
      }
      
      toast({ title: "Pedido Guardado", description: "El nuevo pedido se ha creado exitosamente." });
      
      router.push('/pedidos');

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: error instanceof Error ? error.message : "Ocurrió un error inesperado.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
       <div className="flex items-center gap-4">
        <Link href="/pedidos" passHref>
          <Button variant="outline" size="icon">
            <ArrowLeft />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold font-headline text-primary">Nuevo Pedido</h1>
      </div>
      <PedidoForm 
        mode="nuevo"
        idPedidoGenerado={idPedidoGenerado}
        onSave={handleSavePedido}
        isSaving={isSaving}
      />
    </div>
  );
}
