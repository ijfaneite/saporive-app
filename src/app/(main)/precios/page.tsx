"use client";

import React, { useState, useMemo } from 'react';
import { useData } from '@/lib/data-provider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { filterProductosByTerm } from '@/lib/filter-config';

export default function PreciosPage() {
  const { productos, isDataLoading } = useData();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProductos = useMemo(() => {
    return filterProductosByTerm(productos, searchTerm);
  }, [searchTerm, productos]);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-3xl font-bold font-headline text-primary">Lista de Precios</h1>
       <div className="relative">
        <Input 
          placeholder="Buscar por nombre o código..."
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
      <div className="border rounded-lg">
        {isDataLoading ? (
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
                    <TableCell className="font-medium">
                      {producto.Producto}
                      <p className="text-xs text-muted-foreground">{producto.idProducto}</p>
                    </TableCell>
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
