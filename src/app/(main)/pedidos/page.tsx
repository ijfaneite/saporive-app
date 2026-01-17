"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { Pedido } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Loader2, RefreshCw, Pencil, Printer } from "lucide-react";
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export default function PedidosPage() {
  const { token, asesor, clients, logout } = useAuth();
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

      if (pedidosRes.status === 401) {
        toast({ variant: 'destructive', title: 'Sesión expirada', description: 'Por favor inicie sesión de nuevo.' });
        logout();
        return;
      }

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
  }, [token, asesor, toast, logout]);
  
  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  const getCliente = useCallback((idCliente: string) => {
    return clients.find(c => c.idCliente === idCliente);
  }, [clients]);

  const filteredPedidos = useMemo(() => {
    return pedidos.filter(pedido => {
        if (!searchTerm) return true;
        const lowerCaseSearch = searchTerm.toLowerCase();
        const cliente = getCliente(pedido.idCliente);

        if (cliente?.Cliente.toLowerCase().includes(lowerCaseSearch)) return true;
        if (cliente?.Rif.toLowerCase().includes(lowerCaseSearch)) return true;
        if (pedido.Rif?.toLowerCase().includes(lowerCaseSearch)) return true;
        if (pedido.idPedido.toLowerCase().includes(lowerCaseSearch)) return true;
        if (pedido.Status.toLowerCase().includes(lowerCaseSearch)) return true;
        
        const fecha = format(new Date(pedido.fechaPedido), "dd MMM yyyy", { locale: es }).toLowerCase();
        if (fecha.includes(lowerCaseSearch)) return true;
        
        return false;
    });
  }, [pedidos, searchTerm, getCliente]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }

  const getStatusVariant = (status: string): 'destructive' | 'info' | 'secondary' => {
    const s = status.toLowerCase();
    if (s === 'pendiente') return 'destructive';
    if (s === 'impreso') return 'info';
    return 'secondary';
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
        placeholder="Buscar por cliente, RIF, ID, status..."
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
                {filteredPedidos.map(pedido => {
                    const cliente = getCliente(pedido.idCliente);
                    return (
                        <Card key={pedido.idPedido}>
                            <CardContent className="p-3">
                                <div className="grid grid-cols-[1fr_auto] gap-x-2">
                                    <div>
                                        <p className="font-bold text-foreground truncate" title={pedido.idPedido}>
                                            {pedido.idPedido}
                                        </p>
                                        <p className="truncate text-sm text-muted-foreground" title={cliente?.Cliente}>
                                            {cliente?.Cliente || `ID: ${pedido.idCliente}`}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">{pedido.Rif || cliente?.Rif || 'N/A'}</p>
                                    </div>
                                    <div className='text-right'>
                                      <p className="text-xs text-muted-foreground">
                                          {format(new Date(pedido.fechaPedido), "dd/MMM/yyyy", { locale: es })}
                                      </p>
                                      <Badge 
                                        variant={getStatusVariant(pedido.Status)}
                                        className="mt-1"
                                      >
                                        {pedido.Status}
                                      </Badge>
                                    </div>
                                </div>
                                <div className="flex justify-between items-end mt-2">
                                    <p className="text-xl font-bold text-primary">{formatCurrency(pedido.totalPedido)}</p>
                                    <div className="flex items-center gap-2">
                                        <Link href={`/pedidos/${pedido.idPedido}/imprimir`} passHref legacyBehavior>
                                            <a target="_blank" rel="noopener noreferrer">
                                                <Button variant="outline" size="icon" aria-label="Imprimir Pedido">
                                                    <Printer className="h-4 w-4" />
                                                </Button>
                                            </a>
                                        </Link>
                                        <Link href={`/pedidos/${pedido.idPedido}`} passHref>
                                            <Button variant="outline" size="icon" aria-label="Editar Pedido">
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </ScrollArea>
      )}
    </div>
  );
}
