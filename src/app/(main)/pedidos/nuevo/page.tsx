"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Cliente, Producto } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle, Trash2, ArrowLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';

type LineaPedido = {
  producto: Producto;
  cantidad: number;
};

export default function NuevoPedidoPage() {
  const { token, asesor } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
  const [lineasPedido, setLineasPedido] = useState<LineaPedido[]>([]);
  
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!token || !asesor) return;
      setIsLoading(true);
      try {
        const [clientesRes, productosRes] = await Promise.all([
          fetch(`${API_BASE_URL}${API_ROUTES.clientes}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}${API_ROUTES.productos}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!clientesRes.ok) throw new Error('No se pudieron cargar los clientes');
        const clientesData: Cliente[] = await clientesRes.json();
        setClientes(clientesData.filter(c => c.idAsesor === asesor.idAsesor));

        if (!productosRes.ok) throw new Error('No se pudo cargar la lista de precios');
        const productosData: Producto[] = await productosRes.json();
        setProductos(productosData);
        setFilteredProductos(productosData);

      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error de Carga",
          description: error instanceof Error ? error.message : "No se pudieron cargar los datos iniciales.",
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [token, asesor, toast]);

  useEffect(() => {
    const results = productos.filter(producto =>
      producto.Producto.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProductos(results);
  }, [searchTerm, productos]);

  const handleAddProducto = (producto: Producto) => {
    setLineasPedido(currentLineas => {
      const existing = currentLineas.find(linea => linea.producto.idProducto === producto.idProducto);
      if (existing) {
        toast({
            title: "Producto ya agregado",
            description: "Ya has agregado este producto. Puedes editar la cantidad en la tabla de abajo.",
        });
        return currentLineas;
      }
      return [...currentLineas, { producto, cantidad: 1 }];
    });
  };

  const handleUpdateCantidad = (idProducto: string, cantidad: number) => {
    const newCantidad = !isNaN(cantidad) && cantidad > 0 ? cantidad : 1;
    setLineasPedido(currentLineas =>
      currentLineas.map(linea =>
        linea.producto.idProducto === idProducto ? { ...linea, cantidad: newCantidad } : linea
      )
    );
  };
  
  const handleRemoveProducto = (idProducto: string) => {
    setLineasPedido(currentLineas =>
      currentLineas.filter(linea => linea.producto.idProducto !== idProducto)
    );
  };

  const totalPedido = useMemo(() => {
    return lineasPedido.reduce((total, linea) => {
      return total + (linea.producto.Precio * linea.cantidad);
    }, 0);
  }, [lineasPedido]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES' }).format(value);
  }

  const handleSavePedido = async () => {
    if (!selectedClientId) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Por favor, seleccione un cliente." });
      return;
    }
    if (lineasPedido.length === 0) {
      toast({ variant: "destructive", title: "Pedido vacío", description: "Agregue al menos un producto al pedido." });
      return;
    }
    if (!asesor) {
        toast({ variant: "destructive", title: "Error", description: "No se ha seleccionado un asesor." });
        return;
    }

    setIsSaving(true);
    
    const pedidoPayload = {
      fechaPedido: new Date().toISOString(),
      totalPedido: totalPedido,
      idAsesor: asesor.idAsesor,
      Status: "Pendiente",
      idCliente: selectedClientId,
      detalles: lineasPedido.map(linea => ({
        idProducto: linea.producto.idProducto,
        Precio: linea.producto.Precio,
        Cantidad: linea.cantidad,
        Total: linea.producto.Precio * linea.cantidad,
      })),
    };

    try {
      const response = await fetch(`${API_BASE_URL}${API_ROUTES.pedidos}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(pedidoPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'No se pudo guardar el pedido.');
      }
      
      toast({
        title: "Pedido Guardado",
        description: "El nuevo pedido se ha creado exitosamente.",
      });
      router.push('/pedidos');

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: error instanceof Error ? error.message : "Ocurrió un error inesperado.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
       <div className="flex items-center gap-4">
        <Link href="/pedidos" passHref>
          <Button variant="outline" size="icon">
            <ArrowLeft />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold font-headline text-primary">Nuevo Pedido</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Paso 1: Seleccionar Cliente</CardTitle>
          <CardDescription>Elija el cliente para este pedido.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select onValueChange={setSelectedClientId} value={selectedClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccione un cliente..." />
            </SelectTrigger>
            <SelectContent>
              {clientes.length > 0 ? clientes.map((cliente) => (
                <SelectItem key={cliente.idCliente} value={cliente.idCliente}>
                  {cliente.Cliente} ({cliente.Rif})
                </SelectItem>
              )) : <SelectItem value="no-clients" disabled>No hay clientes para este asesor.</SelectItem>}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Paso 2: Agregar Productos</CardTitle>
          <CardDescription>Busque y seleccione los productos para agregarlos al pedido.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Input 
                placeholder="Buscar producto por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            <ScrollArea className="h-64 border rounded-md">
                <div className="p-4">
                    {filteredProductos.length > 0 ? filteredProductos.map(p => (
                        <div key={p.idProducto} className="flex items-center justify-between p-2 hover:bg-muted rounded-md">
                            <div>
                                <p className="font-semibold">{p.Producto}</p>
                                <p className="text-sm text-muted-foreground">{formatCurrency(p.Precio)}</p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleAddProducto(p)}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Agregar
                            </Button>
                        </div>
                    )) : <p className="text-center text-muted-foreground">No se encontraron productos.</p>}
                </div>
            </ScrollArea>
        </CardContent>
      </Card>

      {lineasPedido.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Paso 3: Revisar Pedido</CardTitle>
            <CardDescription>Ajuste las cantidades y revise el pedido antes de guardarlo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="w-24 text-center">Cantidad</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineasPedido.map(linea => (
                  <TableRow key={linea.producto.idProducto}>
                    <TableCell>
                        <div className="font-medium">{linea.producto.Producto}</div>
                        <div className="text-sm text-muted-foreground">{formatCurrency(linea.producto.Precio)} c/u</div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        value={linea.cantidad}
                        onChange={(e) => handleUpdateCantidad(linea.producto.idProducto, parseInt(e.target.value, 10))}
                        className="text-center"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(linea.producto.Precio * linea.cantidad)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveProducto(linea.producto.idProducto)}>
                        <Trash2 className="text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="flex-col items-end gap-2">
            <div className="text-xl font-bold">
                Total: <span className="text-primary">{formatCurrency(totalPedido)}</span>
            </div>
            <Button onClick={handleSavePedido} disabled={isSaving} className="w-full sm:w-auto">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Pedido
            </Button>
          </CardFooter>
        </Card>
      )}

    </div>
  );
}
