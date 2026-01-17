"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Pedido, PedidoCreatePayload } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { PedidoForm } from '@/components/PedidoForm';

export default function EditarPedidoPage() {
  const { token, products, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const orderId = params.id as string;

  useEffect(() => {
    if (!orderId || !token || !products.length) return;

    const fetchPedido = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}${API_ROUTES.pedidos}${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
            toast({ variant: 'destructive', title: 'Sesión expirada', description: 'Inicie sesión de nuevo.' });
            logout();
            return;
        }

        if (!response.ok) {
          throw new Error('No se pudo cargar el pedido.');
        }
        const data: Pedido = await response.json();
        setPedido(data);

      } catch (error) {
        toast({ variant: "destructive", title: "Error al cargar pedido", description: error instanceof Error ? error.message : "Ocurrió un error inesperado." });
        router.push('/pedidos');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPedido();
  }, [orderId, token, products, router, toast, logout]);

  const handleUpdatePedido = async (pedidoPayload: PedidoCreatePayload) => {
    if (!token) {
        toast({
            variant: "destructive",
            title: "Error de Autenticación",
            description: "No se ha encontrado el token. Por favor, inicie sesión de nuevo.",
        });
        logout();
        return;
    }
   
    setIsSaving(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}${API_ROUTES.pedidos}${orderId}`, {
        method: 'PUT',
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
        throw new Error(errorData.detail || 'No se pudo actualizar el pedido.');
      }
      
      toast({
        title: "Pedido Actualizado",
        description: "El pedido se ha actualizado exitosamente.",
      });
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

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className='ml-4'>Cargando pedido...</p>
        </div>
    );
  }

  if (!pedido) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>No se pudo cargar el pedido.</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
        <div className="flex items-center gap-4">
            <Link href="/pedidos" passHref>
                <Button variant="outline" size="icon">
                    <ArrowLeft />
                </Button>
            </Link>
            <h1 className="text-2xl font-bold font-headline text-primary">Editar Pedido</h1>
        </div>
        <PedidoForm 
            mode="editar"
            initialPedido={pedido}
            onSave={handleUpdatePedido}
            isSaving={isSaving}
        />
    </div>
  );
}
