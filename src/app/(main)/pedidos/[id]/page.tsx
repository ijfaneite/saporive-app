"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data-provider';
import { Pedido, PedidoCreatePayload } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { PedidoForm, PedidoFormRef } from '@/components/PedidoForm';
import { safeFetch } from '@/lib/result';

export default function EditarPedidoPage() {
  const { token, logout } = useAuth();
  const { productos } = useData();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const formRef = useRef<PedidoFormRef>(null);

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const orderId = params.id as string;

  useEffect(() => {
    if (!orderId || !token || !productos.length) return;

    const fetchPedido = async () => {
      setIsLoading(true);
      const result = await safeFetch<Pedido>(`${API_BASE_URL}${API_ROUTES.pedidos}${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (result.success) {
        setPedido(result.value);
      } else {
        if (result.error.code === 401) {
            toast({ variant: 'destructive', title: 'Sesión expirada', description: 'Inicie sesión de nuevo.' });
            logout();
        } else {
            toast({ variant: "destructive", title: "Error al cargar pedido", description: result.error.message });
            router.push('/pedidos');
        }
      }
      setIsLoading(false);
    };

    fetchPedido();
  }, [orderId, token, productos, router, toast, logout]);

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
    
    const result = await safeFetch<Pedido>(`${API_BASE_URL}${API_ROUTES.pedidos}${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(pedidoPayload),
      });

    if (result.success) {
      toast({
        title: "Pedido Actualizado",
        description: "El pedido se ha actualizado exitosamente.",
      });
      router.push(`/pedidos?highlight=${orderId}`);
    } else {
        if (result.error.code === 401) {
            toast({ variant: 'destructive', title: 'Sesión expirada', description: 'Inicie sesión de nuevo.' });
            logout();
        } else {
            toast({
                variant: "destructive",
                title: "Error al guardar",
                description: result.error.message,
              });
        }
    }

    setIsSaving(false);
  };
  
  const handleTriggerSave = () => {
    formRef.current?.submit();
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
    <div className="flex flex-col h-full">
        <div className="flex-shrink-0 p-4 flex items-center justify-between border-b bg-background z-10">
            <div className="flex items-center gap-4">
                <Link href="/pedidos" passHref>
                    <Button variant="outline" size="icon">
                        <ArrowLeft />
                    </Button>
                </Link>
                <h1 className="text-2xl font-bold font-headline text-primary">Editar Pedido</h1>
            </div>
            <Button onClick={handleTriggerSave} disabled={isSaving} size="icon">
                {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
            </Button>
        </div>
        <div className="flex-grow overflow-y-auto">
            <div className="p-4 space-y-4">
                <PedidoForm 
                    ref={formRef}
                    mode="editar"
                    initialPedido={pedido}
                    onSave={handleUpdatePedido}
                    isSaving={isSaving}
                />
            </div>
        </div>
    </div>
  );
}
