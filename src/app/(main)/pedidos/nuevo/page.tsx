"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data-provider';
import { Pedido, PedidoCreatePayload } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { PedidoForm } from '@/components/PedidoForm';
import { useApiStatus } from '@/hooks/use-api-status';
import { safeFetch } from '@/lib/result';

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
        const result = await addLocalPedido({
            idEmpresa: pedidoPayload.idEmpresa,
            totalPedido: pedidoPayload.totalPedido,
            idAsesor: pedidoPayload.idAsesor,
            idCliente: pedidoPayload.idCliente,
            detalles: pedidoPayload.detalles,
        });
        if (result.success) {
            router.push('/pedidos');
        } else {
            toast({
                variant: "destructive",
                title: "Error al guardar localmente",
                description: result.error.message,
            });
        }
        setIsSaving(false);
        return;
    }

    if (!token || !selectedEmpresa) {
        toast({ variant: "destructive", title: "Error de configuración", description: "No se ha seleccionado una empresa o la sesión ha expirado." });
        setIsSaving(false);
        if (!token) logout();
        return;
    }

    const reservedIdResult = await findAndReserveNextPedidoId();
    if (!reservedIdResult.success) {
        toast({
          variant: "destructive",
          title: "Error al generar ID de Pedido",
          description: reservedIdResult.error.message,
        });
        setIsSaving(false);
        return;
    }
    
    const finalPayload = { ...pedidoPayload, idPedido: reservedIdResult.value };

    const saveResult = await safeFetch<Pedido>(`${API_BASE_URL}${API_ROUTES.pedidos}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(finalPayload),
    });

    if (saveResult.success) {
      toast({ title: "Pedido Guardado", description: "El nuevo pedido se ha creado exitosamente." });
      router.push('/pedidos');
    } else {
      if (saveResult.error.code === 401) {
        toast({ variant: 'destructive', title: 'Sesión expirada', description: 'Inicie sesión de nuevo.' });
        logout();
      } else {
        toast({
          variant: "destructive",
          title: "Error al guardar",
          description: saveResult.error.message,
        });
      }
    }
      
    setIsSaving(false);
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
