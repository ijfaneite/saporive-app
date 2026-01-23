"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { PedidoCreatePayload } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { PedidoForm } from '@/components/PedidoForm';
import { useApiStatus } from '@/hooks/use-api-status';

export default function NuevoPedidoPage() {
  const { token, selectedEmpresa, updateEmpresaInState, logout, addLocalPedido } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const isOnline = useApiStatus();

  const [isSaving, setIsSaving] = useState(false);
  const [idPedidoGenerado, setIdPedidoGenerado] = useState<string>('');

  useEffect(() => {
    if (!isOnline) {
        setIdPedidoGenerado("PENDIENTE (OFFLINE)");
    } else if (selectedEmpresa) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const nextId = String(selectedEmpresa.idPedido).padStart(3, '0');
        setIdPedidoGenerado(`${year}${month}${day}-${nextId}`);
    } else {
        setIdPedidoGenerado('Seleccione una empresa');
    }
  }, [selectedEmpresa, isOnline]);

  const handleSavePedido = async (pedidoPayload: PedidoCreatePayload) => {
    setIsSaving(true);
    
    if (!isOnline) {
        try {
            const localPayload = {
                idEmpresa: pedidoPayload.idEmpresa,
                totalPedido: pedidoPayload.totalPedido,
                idAsesor: pedidoPayload.idAsesor,
                idCliente: pedidoPayload.idCliente,
                detalles: pedidoPayload.detalles,
            };
            await addLocalPedido(localPayload);
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


    if (!token) {
        toast({
            variant: "destructive",
            title: "Error de Autenticación",
            description: "No se ha encontrado el token. Por favor, inicie sesión de nuevo.",
        });
        logout();
        setIsSaving(false);
        return;
    }
    if (!selectedEmpresa) {
        toast({ variant: "destructive", title: "Error de configuración", description: "No se ha seleccionado una empresa." });
        setIsSaving(false);
        return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${API_ROUTES.pedidos}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(pedidoPayload),
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
      
      toast({
        title: "Pedido Guardado",
        description: "El nuevo pedido se ha creado exitosamente.",
      });

      if (selectedEmpresa) {
         fetch(`${API_BASE_URL}${API_ROUTES.updateEmpresaPedido}${selectedEmpresa.idEmpresa}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ idPedido: selectedEmpresa.idPedido + 1 }),
            })
            .then(async (res) => {
                if(res.ok) {
                    const updatedEmpresa = await res.json();
                    updateEmpresaInState(updatedEmpresa);
                } else {
                     toast({
                        variant: "destructive",
                        title: "Advertencia de Sincronización",
                        description: "El pedido se guardó, pero el contador de pedidos no pudo actualizarse.",
                    });
                }
            })
            .catch(() => {
                toast({
                    variant: "destructive",
                    title: "Error de Sincronización",
                    description: "El pedido se guardó, pero hubo un error al actualizar el contador.",
                });
            })
      }
      
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
