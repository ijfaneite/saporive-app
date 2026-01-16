"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Pedido, Producto } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';

export default function ImprimirPedidoPage() {
  const { token, asesor, clients, products, selectedEmpresa, isLoading: isAuthLoading } = useAuth();
  const params = useParams();
  const { toast } = useToast();

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
  }, [orderId, token, toast, isAuthLoading]);

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
    <div className="bg-white text-black font-mono p-1 text-xs" style={{ width: '280px', margin: '0 auto' }}>
        <div className="text-center mb-2">
            <h1 className="text-sm font-bold">{selectedEmpresa?.RazonSocial || 'Sapori.ve'}</h1>
        </div>

        <p>------------------------------------</p>
        <div>
            <div className="flex justify-between">
                <span>PEDIDO: {pedido.idPedido}</span>
                <span>{format(new Date(pedido.fechaPedido), 'dd/MM/yy')}</span>
            </div>
            <p>VENDEDOR: {asesor?.Asesor}</p>
        </div>
        <p>------------------------------------</p>
        <div>
            <p>CLIENTE: {cliente?.Cliente}</p>
            <p>RIF: {pedido.Rif || cliente?.Rif}</p>
        </div>
        <p>------------------------------------</p>

        <table className="w-full">
            <thead>
                <tr>
                    <th className="text-left font-normal">DESC.</th>
                    <th className="text-right font-normal px-1">CANT</th>
                    <th className="text-right font-normal">PRECIO</th>
                    <th className="text-right font-normal">TOTAL</th>
                </tr>
            </thead>
            <tbody>
              {pedido.detalles.map((detalle) => {
                return (
                  <React.Fragment key={detalle.id}>
                    <tr>
                      <td colSpan={4} className="text-left pt-1 uppercase">
                        {getProducto(detalle.idProducto)?.Producto ||
                          `ID: ${detalle.idProducto}`}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={1}></td>
                      <td className="text-right px-1">{detalle.Cantidad}</td>
                      <td className="text-right">
                        {formatCurrency(detalle.Precio)}
                      </td>
                      <td className="text-right">
                        {formatCurrency(detalle.Total)}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
        </table>
        
        <p>------------------------------------</p>

        <div className="text-right">
            <p>ITEMS: {pedido.detalles.length}</p>
            <p className="text-sm font-bold">TOTAL: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(pedido.totalPedido)}</p>
        </div>
        
        <div className="text-center mt-4">
            <p>Gracias por su compra!</p>
        </div>
    </div>
  );
}
