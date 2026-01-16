"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { Pedido } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Loader2, RefreshCw, Pencil } from "lucide-react";
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export default function PedidosPage() {
  const { token, asesor, clients } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPedidos = useCallback(async () => {
    if (!token || !asesor) {
      return;
    }
    setIsLoading(true);
    try {
      const pedidosRes = await fetch(`${API_BASE_URL}${API_ROUTES.pedidos}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!pedidosRes.ok) throw new Error('No se pudieron cargar los pedidos');
      
      const pedidosData: Pedido[] = await pedidosRes.json();

      const asesorPedidos = pedidosData
        .filter(p => p.idAsesor === asesor.idAsesor)
        .sort((a, b) => new Date(b.fechaPedido).getTime() - new Date(a.fechaPedido).getTime());

      setPedidos(asesorPedidos);

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error de Carga",
        description: error instanceof Error ? error.message : "Ocurrió un error al cargar los datos.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [token, asesor, toast]);
  
  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  const getClienteName = useCallback((idCliente: string) => {
    const cliente = clients.find(c => c.idCliente === idCliente);
    return cliente ? cliente.Cliente : `ID: ${idCliente.slice(0, 8)}`;
  }, [clients]);

  const filteredPedidos = useMemo(() => {
    return pedidos.filter(pedido => {
        if (!searchTerm) return true;
        const lowerCaseSearch = searchTerm.toLowerCase();

        const clienteName = getClienteName(pedido.idCliente).toLowerCase();
        if (clienteName.includes(lowerCaseSearch)) return true;

        if (pedido.idPedido.toLowerCase().includes(lowerCaseSearch)) return true;
        
        const fecha = format(new Date(pedido.fechaPedido), "dd MMM yyyy", { locale: es }).toLowerCase();
        if (fecha.includes(lowerCaseSearch)) return true;
        
        return false;
    });
  }, [pedidos, searchTerm, getClienteName]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES' }).format(value);
  }

  const getStatusVariant = (status: string): "secondary" | "default" | "destructive" | "outline" | null | undefined => {
    const lowerCaseStatus = status.toLowerCase();
    if (lowerCaseStatus.includes('pendiente')) return 'secondary';
    if (lowerCaseStatus.includes('completado') || lowerCaseStatus.includes('entregado')) return 'default';
    if (lowerCaseStatus.includes('cancelado')) return 'destructive';
    return 'outline';
  }

  return (
    <div className="p-4 space-y-6 flex flex-col h-full">
      <div className="flex justify-between items-center flex-shrink-0">
        <h1 className="text-3xl font-bold font-headline text-primary">Pedidos</h1>
        <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={fetchPedidos} disabled={isLoading}>
                <RefreshCw className={cn(isLoading && 'animate-spin')}/>
            </Button>
            <Link href="/pedidos/nuevo" passHref>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nuevo
                </Button>
            </Link>
        </div>
      </div>

      <Input 
        placeholder="Buscar por cliente, ID o fecha..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {isLoading ? (
        <div className="flex-grow flex justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredPedidos.length === 0 ? (
        <div className="flex-grow flex flex-col justify-center items-center text-center py-10 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">{searchTerm ? 'No se encontraron pedidos con ese criterio.' : 'No hay pedidos recientes.'}</p>
          <Link href="/pedidos/nuevo" passHref>
              <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Crear Nuevo Pedido
              </Button>
          </Link>
        </div>
      ) : (
        <ScrollArea className="flex-grow -mr-4">
            <div className="space-y-4 pr-4">
                {filteredPedidos.map(pedido => (
                    <Card key={pedido.idPedido}>
                        <CardHeader>
                            <div className="flex justify-between items-start gap-2">
                                <div className='flex-grow min-w-0'>
                                    <CardTitle className="text-lg truncate" title={getClienteName(pedido.idCliente)}>{getClienteName(pedido.idCliente)}</CardTitle>
                                    <CardDescription>
                                        {format(new Date(pedido.fechaPedido), "dd MMM yyyy, HH:mm", { locale: es })}
                                    </CardDescription>
                                </div>
                                <div className="flex items-center flex-shrink-0 gap-1">
                                    <Badge variant={getStatusVariant(pedido.Status)} className="whitespace-nowrap">{pedido.Status}</Badge>
                                    <Link href={`/pedidos/${pedido.idPedido}`} passHref>
                                        <Button variant="ghost" size="icon" aria-label="Editar Pedido">
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-end">
                                <p className="text-sm text-muted-foreground">ID: {pedido.idPedido.substring(0,8)}...</p>
                                <p className="text-lg font-bold text-right text-primary">{formatCurrency(pedido.totalPedido)}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </ScrollArea>
      )}
    </div>
  );
}
