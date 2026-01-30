"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data-provider';
import { Pedido, PedidoCreatePayload, DetallePedidoBase, AppError } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Loader2, RefreshCw, Pencil, Printer, Eye, Share2, MoreVertical, X, WifiOff } from "lucide-react";
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
import { filterPedidosByTerm } from '@/lib/filter-config';
import { useApiStatus } from '@/hooks/use-api-status';
import { Result, safeFetch } from '@/lib/result';


export default function PedidosPage() {
  const { token, logout } = useAuth();
  const { asesor, clientes, pedidosLocales, isSyncingLocal, syncLocalPedidos } = useData();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnline = useApiStatus();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  
  const [viewingPedido, setViewingPedido] = useState<Pedido | null>(null);
  const [sharingPedido, setSharingPedido] = useState<Pedido | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [viewingTotals, setViewingTotals] = useState({ itemCount: 0, totalAmount: 0 });
  const shareComponentRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 25;

  const highlightedPedidoId = searchParams.get('highlight');

  const fetchPedidos = useCallback(async (pageNum: number): Promise<Result<Pedido[], AppError>> => {
    if (!token || !asesor) {
      return { success: false, error: new AppError('No autenticado', 401) };
    }

    const offset = (pageNum - 1) * PAGE_SIZE;
    const url = new URL(`${API_BASE_URL}${API_ROUTES.pedidos}`);
    url.searchParams.append('id_asesor', asesor.idAsesor);
    url.searchParams.append('offset', String(offset));
    url.searchParams.append('limit', String(PAGE_SIZE));
    
    return await safeFetch<Pedido[]>(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
  }, [token, asesor]);
  
  const handleFetch = useCallback((pageNum: number) => {
    const isInitialLoad = pageNum === 1;
    if (isInitialLoad) {
      setIsLoading(true);
      setPedidos([]);
    } else {
      setIsFetchingMore(true);
    }

    fetchPedidos(pageNum).then(result => {
        if (result.success) {
            const newPedidos = result.value;
            setPedidos(prev => isInitialLoad ? newPedidos : [...prev, ...newPedidos]);
            setHasMore(newPedidos.length === PAGE_SIZE);
            setPage(pageNum);
        } else {
            if (result.error.code === 401) {
                toast({ variant: 'destructive', title: 'Sesión expirada', description: 'Por favor inicie sesión de nuevo.' });
                logout();
            } else {
                toast({ variant: "destructive", title: "Error de Carga", description: result.error.message });
            }
        }
    }).finally(() => {
        if (isInitialLoad) setIsLoading(false);
        else setIsFetchingMore(false);
    });
  }, [fetchPedidos, toast, logout]);


  const handleRefresh = useCallback(() => {
    if (asesor) {
      setSearchTerm('');
      handleFetch(1);
    }
  }, [asesor, handleFetch]);

  useEffect(() => {
    if (asesor) {
      handleFetch(1);
    } else {
      setIsLoading(false);
    }
  }, [asesor, handleFetch]);
  
  const getCliente = useCallback((idCliente: string) => {
    return clientes.find(c => c.idCliente === idCliente);
  }, [clientes]);

  const combinedPedidos = useMemo(() => {
    const allPedidos = [...pedidosLocales, ...pedidos];
    return allPedidos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [pedidos, pedidosLocales]);

  const filteredPedidos = useMemo(() => {
    return filterPedidosByTerm(combinedPedidos, searchTerm, getCliente);
  }, [combinedPedidos, searchTerm, getCliente]);

  useEffect(() => {
    if (highlightedPedidoId && filteredPedidos.length > 0) {
      const element = document.getElementById(`pedido-${highlightedPedidoId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedPedidoId, filteredPedidos]);


  const observer = useRef<IntersectionObserver>();
  const lastPedidoElementRef = useCallback(node => {
      if (isLoading || isFetchingMore || searchTerm) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver(entries => {
          if (entries[0].isIntersecting && hasMore && !pedidosLocales.length) {
            handleFetch(page + 1);
          }
      });
      if (node) observer.current.observe(node);
  }, [isLoading, isFetchingMore, hasMore, page, handleFetch, searchTerm, pedidosLocales.length]);

  const updatePedidoInState = (updatedPedido: Pedido) => {
    setPedidos(prev => prev.map(p => p.idPedido === updatedPedido.idPedido ? updatedPedido : p));
  };
  
  const updateStatus = useCallback(async (pedidoToUpdate: Pedido, newStatus: string): Promise<Result<Pedido, AppError>> => {
      if (!token || !asesor) {
          return { success: false, error: new AppError('No autenticado', 401) };
      }
  
      const detallesParaEnviar: DetallePedidoBase[] = pedidoToUpdate.detalles.map(linea => ({
          idProducto: linea.idProducto,
          Precio: linea.Precio,
          Cantidad: linea.Cantidad,
      }));
  
      const pedidoPayload: PedidoCreatePayload = {
        idPedido: pedidoToUpdate.idPedido, fechaPedido: pedidoToUpdate.fechaPedido,
        totalPedido: pedidoToUpdate.totalPedido, idAsesor: pedidoToUpdate.idAsesor,
        Status: newStatus, idCliente: pedidoToUpdate.idCliente,
        idEmpresa: pedidoToUpdate.idEmpresa, detalles: detallesParaEnviar,
      };
  
      const result = await safeFetch<Pedido>(`${API_BASE_URL}${API_ROUTES.pedidos}${pedidoToUpdate.idPedido}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(pedidoPayload),
      });
  
      if (result.success) {
          const updatedPedido = result.value;
          updatePedidoInState(updatedPedido);
      }
      
      return result;
  }, [token, asesor]);
  
  const updateStatusToEnviado = useCallback(async (pedidoToUpdate: Pedido): Promise<void> => {
    if (pedidoToUpdate.Status.toLowerCase() !== 'enviado') {
        const result = await updateStatus(pedidoToUpdate, 'Enviado');
        if (!result.success) {
            if (result.error.code === 401) { logout(); }
            toast({ variant: 'destructive', title: 'Error al actualizar estado', description: result.error.message });
        }
    }
  }, [updateStatus, logout, toast]);

  const handlePrint = useCallback(async (pedidoToPrint: Pedido) => {
    const currentStatus = pedidoToPrint.Status.toLowerCase();
    let shouldPrint = true;

    if (currentStatus !== 'impreso' && currentStatus !== 'enviado') {
        const result = await updateStatus(pedidoToPrint, 'Impreso');
        if (result.success) {
            toast({ title: 'Estado Actualizado', description: `El pedido se ha marcado como "Impreso".` });
        } else {
            shouldPrint = false;
            if (result.error.code === 401) { logout(); }
            toast({ variant: 'destructive', title: 'Error al actualizar estado', description: result.error.message });
        }
    }
    
    if (shouldPrint) {
        window.open(`/pedidos/${pedidoToPrint.idPedido}/imprimir`, '_blank');
    }
  }, [updateStatus, logout, toast]);

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }

  const handleSyncLocal = async () => {
    const result = await syncLocalPedidos();
    if (result.success) {
      toast({ title: 'Sincronización Finalizada', description: `${result.value} pedido(s) locales sincronizados.` });
      handleRefresh();
    } else {
      toast({ variant: 'destructive', title: 'Error de Sincronización', description: result.error.message });
    }
  };

  return (
    <div className="py-4 space-y-6 flex flex-col h-full">
      <div className="px-4 flex justify-between items-center flex-shrink-0">
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

      {pedidosLocales.length > 0 && isOnline && (
        <div className="px-4">
            <Card className="border-primary/50 bg-primary/10">
            <CardContent className="p-3 flex items-center justify-between gap-4">
                <div className='space-y-1'>
                <p className="font-bold text-primary">Pedidos locales pendientes</p>
                <p className="text-sm text-foreground/80">
                    Tiene {pedidosLocales.length} pedido(s) guardado(s) localmente.
                </p>
                </div>
                <Button onClick={handleSyncLocal} disabled={isSyncingLocal}>
                <RefreshCw className={cn("mr-2 h-4 w-4", isSyncingLocal && "animate-spin")} />
                {isSyncingLocal ? 'Sincronizando...' : 'Sincronizar'}
                </Button>
            </CardContent>
            </Card>
        </div>
      )}

      <div className="px-4 relative flex-shrink-0">
        <Input 
          placeholder="Buscar por ID, cliente, RIF, zona o estado..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
        {searchTerm && (
            <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
                onClick={() => setSearchTerm('')}
            >
                <X className="h-4 w-4 text-muted-foreground" />
            </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex-grow flex justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : combinedPedidos.length === 0 && !searchTerm ? (
        <div className="flex-grow flex flex-col justify-center items-center text-center py-10 border-2 border-dashed rounded-lg mx-4">
          <p className="text-muted-foreground mb-4">No hay pedidos para mostrar.</p>
          <Link href="/pedidos/nuevo" passHref>
              <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Crear Nuevo Pedido
              </Button>
          </Link>
        </div>
      ) : filteredPedidos.length === 0 ? (
        <div className="flex-grow flex flex-col justify-center items-center text-center py-10">
          <p className="text-muted-foreground">No se encontraron pedidos con ese criterio.</p>
        </div>
      ) : (
        <ScrollArea className="flex-grow">
            <div className="space-y-4 px-4 py-2">
                {filteredPedidos.map((pedido, index) => {
                    const cliente = getCliente(pedido.idCliente);
                    const isLastElement = index === filteredPedidos.length - 1;
                    return (
                        <Card 
                            key={pedido.idPedido}
                            id={`pedido-${pedido.idPedido}`}
                            ref={isLastElement && !searchTerm ? lastPedidoElementRef : null}
                            className={cn(highlightedPedidoId === pedido.idPedido && "ring-2 ring-primary")}
                        >
                           <CardContent className="p-3">
                               <div className="grid grid-cols-[1fr_auto] gap-x-4">
                                   <div className="min-w-0 flex-grow space-y-1 self-center">
                                       <p className="font-bold text-lg text-foreground truncate flex items-center gap-2">
                                           {pedido.isLocal === 1 && <WifiOff className="h-4 w-4 text-destructive shrink-0" title="Pedido Local"/>}
                                           {pedido.idPedido}
                                       </p>
                                       <p className="font-medium truncate">{cliente ? cliente.Cliente : 'Sin cliente'}</p>
                                       {cliente && (
                                           <>
                                            <p className="text-xs text-muted-foreground truncate">{cliente.Rif}</p>
                                            <p className="text-xs text-muted-foreground truncate">{cliente.Zona}</p>
                                           </>
                                       )}
                                   </div>

                                    <div className="flex flex-col items-end gap-1 text-right">
                                        <Badge 
                                            variant={pedido.isLocal ? 'warning' : getStatusVariant(pedido.Status)}
                                        >
                                            {pedido.isLocal ? (isSyncingLocal ? 'Sincronizando...' : 'Local') : pedido.Status}
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
                                            <DropdownMenuItem
                                                disabled={!!pedido.isLocal || pedido.Status.toLowerCase() === 'enviado'}
                                                onSelect={() => router.push(`/pedidos/${pedido.idPedido}`)}
                                            >
                                                <Pencil className="mr-2 h-4 w-4" />
                                                <span>Editar</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => handlePrint(pedido)} disabled={!!pedido.isLocal}>
                                                <Printer className="mr-2 h-4 w-4" />
                                                <span>Imprimir</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setSharingPedido(pedido)} disabled={isSharing || !!pedido.isLocal}>
                                                {isSharing && sharingPedido?.idPedido === pedido.idPedido ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Share2 className="mr-2 h-4 w-4" />
                                                )}
                                                <span>Compartir</span>
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

      <Sheet open={!!viewingPedido} onOpenChange={(isOpen) => {
        if (!isOpen) {
            setViewingPedido(null);
            setViewingTotals({ itemCount: 0, totalAmount: 0 });
        }
      }}>
        <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
            <SheetHeader className="p-6 pb-4 border-b">
                <SheetTitle>Consultar Pedido</SheetTitle>
                <SheetDescription>
                    Visualizando los detalles del pedido <span className='font-bold text-foreground'>{viewingPedido?.idPedido}</span>.
                </SheetDescription>
            </SheetHeader>
            <div className='flex-grow overflow-y-auto'>
                <div className='p-6'>
                {viewingPedido && (
                    <PedidoForm
                        mode="consultar"
                        initialPedido={viewingPedido}
                        isSaving={false}
                        onSave={async () => {}}
                        onTotalsChange={setViewingTotals}
                    />
                )}
                </div>
            </div>
            {viewingTotals.itemCount > 0 && (
                <div className="flex-shrink-0 border-t p-6 flex justify-between items-center">
                    <p className="text-xl font-bold">
                        Items: <span className="text-primary">{viewingTotals.itemCount}</span>
                    </p>
                    <p className="text-xl font-bold">
                        Total: <span className="text-foreground">{formatCurrency(viewingTotals.totalAmount)}</span>
                    </p>
                </div>
            )}
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
