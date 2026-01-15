"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Producto } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from "@/hooks/use-toast";
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
  const { token } = useAuth();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const fetchProductos = async () => {
      if (!token) return;
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}${API_ROUTES.productos}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch productos');
        const data: Producto[] = await response.json();
        setProductos(data);
        setFilteredProductos(data);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo cargar la lista de precios.",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchProductos();
  }, [token, toast]);

  useEffect(() => {
    const results = productos.filter(producto =>
      producto.Producto.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProductos(results);
  }, [searchTerm, productos]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES' }).format(value);
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
        {isLoading ? (
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
