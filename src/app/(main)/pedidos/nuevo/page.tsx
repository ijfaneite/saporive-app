"use client";

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Producto } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle, Trash2, ArrowLeft, ChevronsUpDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from '@/lib/utils';

type LineaPedido = {
  producto: Producto;
  cantidad: number;
};

export default function NuevoPedidoPage() {
  const { token, asesor, clients, products } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [lineasPedido, setLineasPedido] = useState<LineaPedido[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Client Combobox states
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  const filteredClients = useMemo(() => {
    if (!asesor) return [];
    const allAsesorClients = clients.filter(c => c.idAsesor === asesor.idAsesor);
    if (!clientSearch) return allAsesorClients;
    return allAsesorClients.filter(c => 
        c.Cliente.toLowerCase().includes(clientSearch.toLowerCase()) || 
        c.Rif.toLowerCase().includes(clientSearch.toLowerCase())
    );
  }, [clients, asesor, clientSearch]);

  // Product Combobox states
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    return products.filter(p => p.Producto.toLowerCase().includes(productSearch.toLowerCase()));
  }, [products, productSearch]);


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

  const selectedClientName = useMemo(() => {
    if(!selectedClientId) return "Seleccione un cliente...";
    return clients.find(c => c.idCliente === selectedClientId)?.Cliente || "Seleccione un cliente...";
  }, [selectedClientId, clients]);

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
          <CardDescription>Busque y elija el cliente para este pedido.</CardDescription>
        </CardHeader>
        <CardContent>
          <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={clientPopoverOpen} className="w-full justify-between font-normal">
                <span className='truncate'>{selectedClientName}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <div className='p-2 border-b'>
                <Input 
                    placeholder="Buscar cliente por nombre o RIF..." 
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    autoFocus
                />
              </div>
              <ScrollArea className="h-64">
                <div className="p-1">
                    {filteredClients.length > 0 ? filteredClients.map((cliente) => (
                        <div key={cliente.idCliente} 
                            onClick={() => {
                                setSelectedClientId(cliente.idCliente);
                                setClientPopoverOpen(false);
                                setClientSearch("");
                            }}
                            className='text-sm p-2 rounded-sm hover:bg-accent cursor-pointer'
                            >
                           {cliente.Cliente} ({cliente.Rif})
                        </div>
                    )) : <p className="text-center text-sm text-muted-foreground p-4">No se encontraron clientes.</p>}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Paso 2: Agregar Productos</CardTitle>
          <CardDescription>Busque y seleccione los productos para agregarlos al pedido.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Añadir producto al pedido...
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <div className='p-2 border-b'>
                        <Input 
                            placeholder="Buscar producto por nombre..." 
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <ScrollArea className="h-64">
                        <div className="p-1">
                        {filteredProducts.length > 0 ? filteredProducts.map(p => (
                            <div key={p.idProducto} 
                                className="flex items-center justify-between p-2 hover:bg-muted rounded-sm cursor-pointer"
                                onClick={() => {
                                    handleAddProducto(p);
                                    setProductPopoverOpen(false);
                                    setProductSearch("");
                                }}
                            >
                                <div>
                                    <p className="font-semibold text-sm">{p.Producto}</p>
                                    <p className="text-xs text-muted-foreground">{formatCurrency(p.Precio)}</p>
                                </div>
                                <PlusCircle className="h-5 w-5 text-primary" />
                            </div>
                        )) : <p className="text-center text-sm text-muted-foreground p-4">No se encontraron productos.</p>}
                        </div>
                    </ScrollArea>
                </PopoverContent>
            </Popover>
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
