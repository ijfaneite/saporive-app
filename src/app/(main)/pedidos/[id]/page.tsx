"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Producto, Pedido, DetallePedidoBase, PedidoCreatePayload } from '@/lib/types';
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
  // id único para el manejo del estado en el frontend
  id: string; 
  producto: Producto;
  cantidad: string;
};

export default function EditarPedidoPage() {
  const { token, asesor, clients, products, selectedEmpresa, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [lineasPedido, setLineasPedido] = useState<LineaPedido[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const orderId = params.id as string;

  useEffect(() => {
    if (!orderId || !token || !products.length) return;

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
          throw new Error('No se pudo cargar el pedido.');
        }
        const data: Pedido = await response.json();
        setPedido(data);
        setSelectedClientId(data.idCliente);
        
        const lineas = data.detalles.map(detalle => {
            const producto = products.find(p => p.idProducto === detalle.idProducto);
            return {
              id: detalle.id, // Usar el ID del detalle de la BD
              producto: producto || { 
                  idProducto: detalle.idProducto, 
                  Producto: `(No disponible) ID: ${detalle.idProducto}`, 
                  Precio: detalle.Precio,
                },
              cantidad: String(detalle.Cantidad),
            };
        });

        setLineasPedido(lineas);

      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error al cargar pedido",
          description: error instanceof Error ? error.message : "Ocurrió un error inesperado.",
        });
        router.push('/pedidos');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPedido();
  }, [orderId, token, products, router, toast, logout]);

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
      // Asignar un ID temporal para nuevos productos
      return [...currentLineas, { id: `new-${Date.now()}`, producto, cantidad: "1" }];
    });
  };

  const handleUpdateCantidad = (id: string, cantidad: string) => {
    if (cantidad === '' || (parseInt(cantidad) > 0)) {
        setLineasPedido(currentLineas =>
          currentLineas.map(linea =>
            linea.id === id ? { ...linea, cantidad: cantidad } : linea
          )
        );
    }
  };
  
  const handleCantidadBlur = (id: string, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1) {
        setLineasPedido(currentLineas =>
            currentLineas.map(linea =>
              linea.id === id ? { ...linea, cantidad: "1" } : linea
            )
          );
    }
  }

  const handleRemoveProducto = (id: string) => {
    setLineasPedido(currentLineas =>
      currentLineas.filter(linea => linea.id !== id)
    );
  };

  const totalPedido = useMemo(() => {
    return lineasPedido.reduce((total, linea) => {
        const cantidad = parseInt(linea.cantidad, 10) || 0;
        return total + (linea.producto.Precio * cantidad);
    }, 0);
  }, [lineasPedido]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }

  const handleUpdatePedido = async () => {
    // --- VALIDACIONES ---
    if (!token) {
        toast({
            variant: "destructive",
            title: "Error de Autenticación",
            description: "No se ha encontrado el token. Por favor, inicie sesión de nuevo.",
        });
        logout();
        return;
    }
    if (!selectedClientId || !pedido) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Por favor, seleccione un cliente." });
      return;
    }
    if (lineasPedido.length === 0 || lineasPedido.some(l => !l.cantidad || parseInt(l.cantidad) === 0)) {
      toast({ variant: "destructive", title: "Pedido inválido", description: "Agregue productos y asegúrese de que las cantidades no sean cero." });
      return;
    }
    if (!asesor || !selectedEmpresa) {
        toast({ variant: "destructive", title: "Error de configuración", description: "No se ha seleccionado un asesor o empresa." });
        return;
    }

    setIsSaving(true);
    
    // --- CONSTRUCCIÓN DEL PAYLOAD ---
    const detallesParaEnviar: DetallePedidoBase[] = lineasPedido.map(linea => ({
        idProducto: linea.producto.idProducto,
        Precio: linea.producto.Precio,
        Cantidad: parseInt(linea.cantidad, 10) || 1,
    }));

    const pedidoPayload: PedidoCreatePayload = {
      idPedido: pedido.idPedido,
      fechaPedido: new Date().toISOString(), // Usar fecha actual para la actualización
      totalPedido: totalPedido,
      idAsesor: asesor.idAsesor,
      Status: pedido.Status, // Se mantiene el status actual del pedido
      idCliente: selectedClientId,
      idEmpresa: selectedEmpresa.idEmpresa,
      detalles: detallesParaEnviar,
    };

    // --- LLAMADA A LA API ---
    try {
      const response = await fetch(`${API_BASE_URL}${API_ROUTES.pedidos}${orderId}`, {
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
        setIsSaving(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Error desconocido del servidor.' }));
        throw new Error(errorData.detail || 'No se pudo actualizar el pedido.');
      }
      
      toast({
        title: "Pedido Actualizado",
        description: "El pedido se ha actualizado exitosamente.",
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

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className='ml-4'>Cargando pedido...</p>
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
        <h1 className="text-3xl font-bold font-headline text-primary">Editar Pedido</h1>
      </div>

      <Card>
          <CardHeader>
              <CardTitle>Información del Pedido</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-sm'>
              <p><span className='font-semibold'>Nro. Pedido:</span> <span className="font-bold text-primary">{pedido?.idPedido}</span></p>
              <p><span className='font-semibold'>Asesor:</span> {asesor?.Asesor || 'No seleccionado'}</p>
          </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cliente</CardTitle>
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
          <CardTitle>Productos</CardTitle>
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
            <CardTitle>Revisar Pedido</CardTitle>
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
                  <TableRow key={linea.id}>
                    <TableCell>
                        <div className={cn("font-medium", linea.producto.Producto.startsWith('(No disponible)') && 'text-destructive')}>
                            {linea.producto.Producto}
                        </div>
                        <div className="text-sm text-muted-foreground">{formatCurrency(linea.producto.Precio)} c/u</div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={linea.cantidad}
                        onChange={(e) => handleUpdateCantidad(linea.id, e.target.value)}
                        onBlur={(e) => handleCantidadBlur(linea.id, e.target.value)}
                        className="text-center"
                        min="1"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(linea.producto.Precio * (parseInt(linea.cantidad, 10) || 0))}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveProducto(linea.id)}>
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
            <Button onClick={handleUpdatePedido} disabled={isSaving} className="w-full sm:w-auto">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Cambios
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
