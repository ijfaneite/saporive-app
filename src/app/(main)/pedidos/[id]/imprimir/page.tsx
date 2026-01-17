"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Pedido, Producto, Cliente, PedidoCreatePayload, DetallePedidoBase } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function ImprimirPedidoPage() {
  const { token, asesor, clients, products, selectedEmpresa, isLoading: isAuthLoading, logout } = useAuth();
  const params = useParams();
  const { toast } = useToast();
  const logo = PlaceHolderImages.find(img => img.id === 'logo');

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const orderId = params.id as string;

  const updateStatusToEnviado = useCallback(async (): Promise<boolean> => {
    if (!token || !pedido || !asesor || !selectedEmpresa) {
        toast({
            variant: "destructive",
            title: "Error de Sincronización",
            description: "No se pudo actualizar el estado del pedido.",
        });
        return false;
    }

    if (pedido.Status.toLowerCase() === 'enviado') {
      return true; // Already sent, no need to update
    }

    const detallesParaEnviar: DetallePedidoBase[] = pedido.detalles.map(linea => ({
        idProducto: linea.idProducto,
        Precio: linea.Precio,
        Cantidad: linea.Cantidad,
    }));

    const pedidoPayload: PedidoCreatePayload = {
      idPedido: pedido.idPedido,
      fechaPedido: pedido.fechaPedido,
      totalPedido: pedido.totalPedido,
      idAsesor: pedido.idAsesor,
      Status: "Enviado",
      idCliente: pedido.idCliente,
      idEmpresa: pedido.idEmpresa,
      detalles: detallesParaEnviar,
    };

    try {
      const response = await fetch(`${API_BASE_URL}${API_ROUTES.pedidos}${pedido.idPedido}`, {
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
        return false;
      }

      if (response.ok) {
         toast({
            title: 'Estado Actualizado',
            description: 'El pedido se ha marcado como "Enviado".'
        });
        return true;
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'No se pudo cambiar el estado del pedido a "Enviado".' }));
        toast({
            variant: 'destructive',
            title: 'Error al actualizar',
            description: errorData.detail || 'No se pudo cambiar el estado del pedido a "Enviado".'
        });
        return false;
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error de Conexión",
        description: "No se pudo comunicar con el servidor para actualizar el estado.",
      });
      return false;
    }
  }, [pedido, token, asesor, selectedEmpresa, toast, logout]);

  useEffect(() => {
    if (isAuthLoading || !orderId || !token) return;

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
          throw new Error('No se pudo cargar el pedido para imprimir.');
        }
        const data: Pedido = await response.json();
        setPedido(data);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error al cargar pedido',
          description: error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPedido();
  }, [orderId, token, toast, isAuthLoading, logout]);
  
  useEffect(() => {
    if (isAuthLoading || isLoading || !pedido) {
      return;
    }

    document.title = `Pedido-${pedido.idPedido}`;

    const handleAfterPrint = async () => {
      if (pedido.Status.toLowerCase() !== 'enviado') {
        await updateStatusToEnviado();
      }
      window.close();
    };

    window.addEventListener('afterprint', handleAfterPrint);
    
    window.print();

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [isAuthLoading, isLoading, pedido, updateStatusToEnviado]);

  const cliente = useMemo(() => {
    if (!pedido) return null;
    return clients.find(c => c.idCliente === pedido.idCliente);
  }, [pedido, clients]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };
  
  const getProducto = (idProducto: string): Producto | undefined => {
      return products.find(p => p.idProducto === idProducto);
  }

  if (isLoading || isAuthLoading || !pedido) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
        <p className="ml-4 text-black">Preparando impresión...</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white text-black p-8 font-sans text-sm">
        <div className="flex justify-between items-start mb-4 border-b border-gray-400 pb-4">
            <div>
                {logo && (
                    <Image
                        src={logo.imageUrl}
                        alt={logo.description}
                        width={120}
                        height={120}
                        data-ai-hint={logo.imageHint}
                    />
                )}
                <h1 className="text-xl font-bold mt-2">{selectedEmpresa?.RazonSocial || 'Sapori.ve'}</h1>
            </div>

            <div className="text-right">
                <p className="text-lg font-bold text-black">Pedido Nro.: {pedido.idPedido}</p>
                <p className="mt-2">{format(new Date(pedido.fechaPedido), "dd/MMM/yyyy", { locale: es })}</p>
            </div>
        </div>

        <div className="mb-6 space-y-2">
            <div>
                <span className="font-bold">Cliente: </span>
                <span>{cliente?.idCliente} - {cliente?.Cliente}</span>
            </div>
            <div>
                <span className="font-bold">Rif: </span>
                <span>{pedido.Rif || cliente?.Rif}</span>
            </div>
            <div>
                <span className="font-bold">Asesor: </span>
                <span>{asesor?.idAsesor} - {asesor?.Asesor}</span>
            </div>
        </div>

        <table className="w-full text-left table-auto">
            <thead className="border-b border-gray-400 bg-gray-100">
                <tr>
                    <th className="p-2">Item</th>
                    <th className="p-2 w-2/5">Producto</th>
                    <th className="p-2 text-right">Cantidad</th>
                    <th className="p-2 text-right">Precio</th>
                    <th className="p-2 text-right">Total</th>
                </tr>
            </thead>
            <tbody>
              {pedido.detalles.map((detalle, index) => {
                  const productoInfo = getProducto(detalle.idProducto);
                  return (
                    <tr key={detalle.id} className="border-b border-gray-400">
                        <td className="p-2">{index + 1}</td>
                        <td className="p-2">
                            {productoInfo?.idProducto} - {productoInfo?.Producto || `ID: ${detalle.idProducto}`}
                        </td>
                        <td className="p-2 text-right">{detalle.Cantidad}</td>
                        <td className="p-2 text-right">{formatCurrency(detalle.Precio)}</td>
                        <td className="p-2 text-right">{formatCurrency(detalle.Total)}</td>
                    </tr>
                  )
                })}
            </tbody>
        </table>
        
        <div className="flex justify-end mt-6">
            <div className="w-1/3 space-y-2">
                <div className="flex justify-between">
                    <span>Items:</span>
                    <span>{pedido.detalles.length}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-400 pt-2">
                    <span>TOTAL:</span>
                    <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(pedido.totalPedido)}</span>
                </div>
            </div>
        </div>
        
        <div className="text-center mt-8 text-gray-500">
            <p>Gracias por su compra!</p>
        </div>
    </div>
  );
}
