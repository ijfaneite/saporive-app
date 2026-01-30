"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data-provider';
import { Pedido, PedidoCreatePayload } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { PedidoForm, PedidoFormRef } from '@/components/PedidoForm';
import { useApiStatus } from '@/hooks/use-api-status';
import { safeFetch } from '@/lib/result';

export default function NuevoPedidoPage() {
  const { token, logout } = useAuth();
  const { selectedEmpresa, addLocalPedido, findAndReserveNextPedidoId } = useData();
  const router = useRouter();
  const { toast } = useToast();
  const isOnline = useApiStatus();
  const formRef = useRef<PedidoFormRef>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [idPedidoGenerado, setIdPedidoGenerado] = useState<string>('');
  const [totals, setTotals] = useState({ itemCount: 0, totalAmount: 0 });

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
      toast({ title: "Pedido Guardado", description: `El pedido ${finalPayload.idPedido} se ha creado exitosamente.` });
      router.push(`/pedidos?highlight=${finalPayload.idPedido}`);
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
  
  const handleTriggerSave = () => {
    formRef.current?.submit();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
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
                <h1 className="text-2xl font-bold font-headline text-primary">Nuevo Pedido</h1>
            </div>
            <Button onClick={handleTriggerSave} disabled={isSaving} size="icon">
                {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
            </Button>
        </div>
        <div className="flex-grow overflow-y-auto">
            <div className="p-4 space-y-4">
                <PedidoForm 
                    ref={formRef}
                    mode="nuevo"
                    idPedidoGenerado={idPedidoGenerado}
                    onSave={handleSavePedido}
                    isSaving={isSaving}
                    onTotalsChange={setTotals}
                />
            </div>
        </div>
        {totals.itemCount > 0 && (
            <div className="flex-shrink-0 border-t bg-background p-4 flex justify-between items-center">
                <p className="text-xl font-bold">
                    Items: <span className="text-primary">{totals.itemCount}</span>
                </p>
                <p className="text-xl font-bold">
                    Total: <span className="text-foreground">{formatCurrency(totals.totalAmount)}</span>
                </p>
            </div>
        )}
    </div>
  );
}
