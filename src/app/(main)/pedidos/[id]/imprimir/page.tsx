"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Pedido, Producto, Cliente } from '@/lib/types';
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
    if (!isLoading && pedido) {
      // Small timeout to ensure all content is rendered before printing
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, pedido]);

  useEffect(() => {
    const handleAfterPrint = () => {
      window.close();
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

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
        {/* Header section */}
        <div className="flex justify-between items-start mb-4 border-b pb-4">
            {/* Left side: Logo and Company Name */}
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

            {/* Right side: Order Number and Date */}
            <div className="text-right">
                <p className="text-lg font-bold">Pedido Nro.: {pedido.idPedido}</p>
                <p className="mt-2">{format(new Date(pedido.fechaPedido), "dd/MMM/yyyy", { locale: es })}</p>
            </div>
        </div>

        {/* Client and Asesor section */}
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

        {/* Details Table */}
        <table className="w-full text-left table-auto">
            <thead className="border-b bg-gray-100">
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
                    <tr key={detalle.id} className="border-b">
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
        
        {/* Footer section */}
        <div className="flex justify-end mt-6">
            <div className="w-1/3 space-y-2">
                <div className="flex justify-between">
                    <span>Items:</span>
                    <span>{pedido.detalles.length}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
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
