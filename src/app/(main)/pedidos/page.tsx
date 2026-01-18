"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { Pedido, PedidoCreatePayload, DetallePedidoBase } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Loader2, RefreshCw, Pencil, Printer, Eye, Share2 } from "lucide-react";
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PedidoForm } from '@/components/PedidoForm';
import html2canvas from 'html2canvas';
import { PedidoShareImage } from '@/components/PedidoShareImage';
import { getStatusVariant } from '@/lib/status-config';


export default function PedidosPage() {
  const { token, asesor, clients, logout, products } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingPedido, setViewingPedido] = useState<Pedido | null>(null);
  const [sharingPedido, setSharingPedido] = useState<Pedido | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const shareComponentRef = useRef<HTMLDivElement>(null);

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

    const handleFocus = () => {
      fetchPedidos();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchPedidos]);

  const updateStatusToEnviado = useCallback(async (pedidoToUpdate: Pedido): Promise<void> => {
    if (!token || !asesor) {
        toast({
            variant: "destructive",
            title: "Error de Sincronización",
            description: "No se pudo actualizar el estado del pedido.",
        });
        return;
    }
    
    const currentStatus = pedidoToUpdate.Status.toLowerCase();
    if (currentStatus === 'enviado') {
        return; // Already sent, no need to update
    }

    const detallesParaEnviar: DetallePedidoBase[] = pedidoToUpdate.detalles.map(linea => ({
        idProducto: linea.idProducto,
        Precio: linea.Precio,
        Cantidad: linea.Cantidad,
    }));

    const pedidoPayload: PedidoCreatePayload = {
      idPedido: pedidoToUpdate.idPedido,
      fechaPedido: pedidoToUpdate.fechaPedido,
      totalPedido: pedidoToUpdate.totalPedido,
      idAsesor: pedidoToUpdate.idAsesor,
      Status: "Enviado",
      idCliente: pedidoToUpdate.idCliente,
      idEmpresa: pedidoToUpdate.idEmpresa,
      detalles: detallesParaEnviar,
    };

    try {
      const response = await fetch(`${API_BASE_URL}${API_ROUTES.pedidos}${pedidoToUpdate.idPedido}`, {
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
        return;
      }

      if (response.ok) {
        toast({
           title: 'Estado Actualizado',
           description: 'El pedido se ha marcado como "Enviado".'
       });
       fetchPedidos();
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'No se pudo cambiar el estado.' }));
        toast({
            variant: 'destructive',
            title: 'Error al actualizar',
            description: errorData.detail,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error de Conexión",
        description: "No se pudo comunicar con el servidor.",
      });
    }
  }, [token, asesor, toast, logout, fetchPedidos]);

  useEffect(() => {
    if (sharingPedido && shareComponentRef.current) {
      setIsSharing(true);
      
      setTimeout(() => {
        if (!shareComponentRef.current) return;

        html2canvas(shareComponentRef.current, { useCORS: true, scale: 2 })
          .then(canvas => {
            canvas.toBlob(async (blob) => {
              if (!blob) {
                toast({ variant: 'destructive', title: 'Error al generar imagen' });
                return;
              }

              const fileName = `Pedido-${sharingPedido.idPedido}.png`;
              const file = new File([blob], fileName, { type: 'image/png' });
              
              if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                  await navigator.share({
                    files: [file],
                    title: `Pedido ${sharingPedido.idPedido}`,
                    text: `Adjunto el pedido ${sharingPedido.idPedido}.`,
                  });
                  await updateStatusToEnviado(sharingPedido);
                } catch (error) {
                  console.info("Share cancelled by user", error);
                }
              } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
                toast({
                  title: 'Imagen descargada',
                  description: 'La imagen del pedido se ha guardado en tu dispositivo.',
                });
                await updateStatusToEnviado(sharingPedido);
              }
            });
          })
          .catch(err => {
            console.error("Error generating image:", err);
            toast({ variant: 'destructive', title: 'Error al generar imagen' });
          })
          .finally(() => {
             setIsSharing(false);
             setSharingPedido(null);
          });
      }, 500);
    }
  }, [sharingPedido, updateStatusToEnviado, toast]);

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
        className="flex-shrink-0"
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
        <ScrollArea className="flex-grow pr-4 -mr-4">
            <div className="space-y-4 pr-4">
                {filteredPedidos.map(pedido => {
                    const cliente = getCliente(pedido.idCliente);
                    return (
                        <Card key={pedido.idPedido}>
                            <CardContent className="p-3">
                                <div className="grid grid-cols-[1fr_auto] gap-x-4">
                                    <div className="min-w-0 text-right">
                                        <p className="font-bold text-foreground truncate" title={pedido.idPedido}>
                                            {pedido.idPedido}
                                        </p>
                                        <p className="truncate text-sm text-muted-foreground" title={cliente?.Cliente}>
                                            {cliente?.Cliente || `ID: ${pedido.idCliente}`}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">{pedido.Rif || cliente?.Rif || 'N/A'}</p>
                                    </div>
                                    <div className="flex flex-col items-end justify-center gap-0.5">
                                        <Badge 
                                            variant={getStatusVariant(pedido.Status)}
                                        >
                                            {pedido.Status}
                                        </Badge>
                                        <p className="text-xs text-muted-foreground">
                                            {format(new Date(pedido.fechaPedido), "dd/MMM/yyyy", { locale: es })}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {format(new Date(pedido.updatedAt), "h:mm a", { locale: es })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex justify-between items-end mt-2">
                                    <p className="text-xl font-bold text-primary">{formatCurrency(pedido.totalPedido)}</p>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="icon" aria-label="Consultar Pedido" onClick={() => setViewingPedido(pedido)}>
                                            <Eye className="h-4 w-4 text-primary" />
                                        </Button>
                                        <Button variant="outline" size="icon" aria-label="Compartir Pedido" onClick={() => setSharingPedido(pedido)} disabled={isSharing}>
                                            {isSharing && sharingPedido?.idPedido === pedido.idPedido ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4 text-primary" />}
                                        </Button>
                                        <Link href={`/pedidos/${pedido.idPedido}/imprimir`} passHref legacyBehavior>
                                            <a target="_blank" rel="noopener noreferrer">
                                                <Button variant="outline" size="icon" aria-label="Imprimir Pedido">
                                                    <Printer className="h-4 w-4 text-primary" />
                                                </Button>
                                            </a>
                                        </Link>
                                        {pedido.Status.toLowerCase() === 'enviado' ? (
                                            <Button variant="outline" size="icon" aria-label="Editar Pedido" disabled>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Link href={`/pedidos/${pedido.idPedido}`} passHref>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    aria-label="Editar Pedido"
                                                >
                                                    <Pencil className="h-4 w-4 text-primary" />
                                                </Button>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </ScrollArea>
      )}

      <Sheet open={!!viewingPedido} onOpenChange={(isOpen) => !isOpen && setViewingPedido(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
                <SheetTitle>Consultar Pedido</SheetTitle>
                <SheetDescription>
                    Visualizando los detalles del pedido <span className='font-bold text-foreground'>{viewingPedido?.idPedido}</span>.
                </SheetDescription>
            </SheetHeader>
            <div className='mt-4'>
              {viewingPedido && (
                  <PedidoForm
                      mode="consultar"
                      initialPedido={viewingPedido}
                      isSaving={false}
                      onSave={async () => {}}
                  />
              )}
            </div>
        </SheetContent>
      </Sheet>

      {sharingPedido && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }}>
          <div ref={shareComponentRef}>
            <PedidoShareImage pedido={sharingPedido} />
          </div>
        </div>
      )}

    </div>
  );
}
