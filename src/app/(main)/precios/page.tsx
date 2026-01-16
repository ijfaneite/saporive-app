"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { Producto } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function PreciosPage() {
  const { products, isLoading: isAuthLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProductos = useMemo(() => {
    if (!searchTerm) return products;
    return products.filter(producto =>
        producto.Producto.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, products]);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-3xl font-bold font-headline text-primary">Lista de Precios</h1>
      <Input 
        placeholder="Buscar producto..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <div className="border rounded-lg">
        {isAuthLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Precio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProductos.length > 0 ? (
                filteredProductos.map((producto) => (
                  <TableRow key={producto.idProducto}>
                    <TableCell className="font-medium">{producto.Producto}</TableCell>
                    <TableCell className="text-right">{formatCurrency(producto.Precio)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="text-center">
                    No se encontraron productos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
