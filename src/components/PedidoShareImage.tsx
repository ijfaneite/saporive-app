"use client";

import React from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth';
import { Pedido, Producto } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PlaceHolderImages } from '@/lib/placeholder-images';

interface PedidoShareImageProps {
  pedido: Pedido;
}

export function PedidoShareImage({ pedido }: PedidoShareImageProps) {
  const { asesor, clients, products, selectedEmpresa } = useAuth();
  const logo = PlaceHolderImages.find(img => img.id === 'logo');

  const cliente = clients.find(c => c.idCliente === pedido.idCliente);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };

  const getProducto = (idProducto: string): Producto | undefined => {
    return products.find(p => p.idProducto === idProducto);
  };

  return (
    <div className="bg-white text-black p-8 font-sans text-sm" style={{ width: '595px' }}>
        <div className="flex justify-between items-start mb-4 border-b border-gray-400 pb-4">
            <div>
                {logo && (
                    <Image
                        src={logo.imageUrl}
                        alt={logo.description}
                        width={90}
                        height={40}
                        data-ai-hint={logo.imageHint}
                        unoptimized
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
