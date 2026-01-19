"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Pedido, PedidoCreatePayload, DetallePedidoBase } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Loader2, RefreshCw, Pencil, Printer, Eye, Share2, MoreVertical } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


export default function PedidosPage() {
  const { token, asesor, clients, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  
  const [viewingPedido, setViewingPedido] = useState<Pedido | null>(null);
  const [sharingPedido, setSharingPedido] = useState<Pedido | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const shareComponentRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 25;

  const fetchPedidos = useCallback(async (pageNum: number, search: string) => {
    if (!token || !asesor) {
      return;
    }

    if (pageNum === 1) setIsLoading(true);
    else setIsFetchingMore(true);

    try {
      const offset = (pageNum - 1) * PAGE_SIZE;
      const url = new URL(`${API_BASE_URL}${API_ROUTES.pedidos}`);
      url.searchParams.append('id_asesor', asesor.idAsesor);
      url.searchParams.append('offset', String(offset));
      url.searchParams.append('limit', String(PAGE_SIZE));
      if (search) {
        url.searchParams.append('search', search);
      }
      
      const pedidosRes = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (pedidosRes.status === 401) {
        toast({ variant: 'destructive', title: 'Sesión expirada', description: 'Por favor inicie sesión de nuevo.' });
        logout();
        return;
      }

      if (!pedidosRes.ok) throw new Error('No se pudieron cargar los pedidos');
      
      const newPedidos: Pedido[] = await pedidosRes.json();

      setPedidos(prev => pageNum === 1 ? newPedidos : [...prev, ...newPedidos]);
      
      if (newPedidos.length < PAGE_SIZE) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
      setPage(pageNum);

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error de Carga",
        description: error instanceof Error ? error.message : "Ocurrió un error al cargar los datos.",
      });
    } finally {
      if (pageNum === 1) setIsLoading(false);
      else setIsFetchingMore(false);
    }
  }, [token, asesor, toast, logout]);
  
  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
        setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleRefresh = useCallback(() => {
    if (asesor) {
      fetchPedidos(1, debouncedSearchTerm);
    }
  }, [asesor, fetchPedidos, debouncedSearchTerm]);

  // Effect for initial load and search term changes
  useEffect(() => {
    if (asesor) {
      fetchPedidos(1, debouncedSearchTerm);
    }
  }, [asesor, debouncedSearchTerm, fetchPedidos]);
  
  const observer = useRef<IntersectionObserver>();
  const lastPedidoElementRef = useCallback(node => {
      if (isLoading || isFetchingMore) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver(entries => {
          if (entries[0].isIntersecting && hasMore) {
              fetchPedidos(page + 1, debouncedSearchTerm);
          }
      });
      if (node) observer.current.observe(node);
  }, [isLoading, isFetchingMore, hasMore, page, debouncedSearchTerm, fetchPedidos]);

  const updateStatusToEnviado = useCallback(async (pedidoToUpdate: Pedido): Promise<void> => {
    if (!token || !asesor) {
        toast({ variant: "destructive", title: "Error de Sincronización", description: "No se pudo actualizar el estado del pedido." });
        return;
    }
    
    if (pedidoToUpdate.Status.toLowerCase() === 'enviado') return;

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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(pedidoPayload),
      });

      if (response.status === 401) {
        toast({ variant: 'destructive', title: 'Sesión expirada', description: 'Inicie sesión de nuevo.' });
        logout();
        return;
      }

      if (response.ok) {
        toast({ title: 'Estado Actualizado', description: 'El pedido se ha marcado como "Enviado".' });
        handleRefresh();
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'No se pudo cambiar el estado.' }));
        toast({ variant: 'destructive', title: 'Error al actualizar', description: errorData.detail });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error de Conexión", description: "No se pudo comunicar con el servidor." });
    }
  }, [token, asesor, toast, logout, handleRefresh]);

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
                toast({ title: 'Imagen descargada', description: 'La imagen del pedido se ha guardado en tu dispositivo.' });
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }

  return (
    <div className="p-4 space-y-6 flex flex-col h-full">
      <div className="flex justify-between items-center flex-shrink-0">
        <h1 className="text-3xl font-bold font-headline text-primary">Pedidos</h1>
        <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading || isFetchingMore}>
                <RefreshCw className={cn((isLoading || isFetchingMore) && 'animate-spin')}/>
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
      ) : pedidos.length === 0 ? (
        <div className="flex-grow flex flex-col justify-center items-center text-center py-10 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">{searchTerm ? 'No se encontraron pedidos con ese criterio.' : 'No hay pedidos para mostrar.'}</p>
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
                {pedidos.map((pedido, index) => {
                    const cliente = getCliente(pedido.idCliente);
                    const isLastElement = index === pedidos.length - 1;
                    return (
                        <Card key={pedido.idPedido} ref={isLastElement ? lastPedidoElementRef : null}>
                           <CardContent className="p-3">
                               <div className="grid grid-cols-[1fr_auto] gap-x-4">
                                   <div className="min-w-0 flex-grow space-y-1 self-center">
                                       <p className="font-bold text-lg text-foreground truncate">{pedido.idPedido}</p>
                                       <p className="font-medium truncate">{cliente ? cliente.Cliente : 'Sin cliente'}</p>
                                       {cliente && (
                                           <p className="text-xs text-muted-foreground truncate">{cliente.Rif}</p>
                                       )}
                                   </div>

                                    <div className="flex flex-col items-end gap-1 text-right">
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
                                    <p className="text-xl font-bold text-foreground">{formatCurrency(pedido.totalPedido)}</p>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreVertical className="h-4 w-4" />
                                                <span className="sr-only">Abrir menú</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onSelect={() => setTimeout(() => setViewingPedido(pedido), 0)}>
                                                <Eye className="mr-2 h-4 w-4" />
                                                <span>Consultar</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setSharingPedido(pedido)} disabled={isSharing}>
                                                {isSharing && sharingPedido?.idPedido === pedido.idPedido ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Share2 className="mr-2 h-4 w-4" />
                                                )}
                                                <span>Compartir</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => window.open(`/pedidos/${pedido.idPedido}/imprimir`, '_blank')}>
                                                <Printer className="mr-2 h-4 w-4" />
                                                <span>Imprimir</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                disabled={pedido.Status.toLowerCase() === 'enviado'}
                                                onSelect={() => {
                                                    if (pedido.Status.toLowerCase() !== 'enviado') {
                                                        router.push(`/pedidos/${pedido.idPedido}`);
                                                    }
                                                }}
                                            >
                                                <Pencil className="mr-2 h-4 w-4" />
                                                <span>Editar</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
                 {isFetchingMore && (
                    <div className="flex justify-center items-center p-4">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                 )}
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
