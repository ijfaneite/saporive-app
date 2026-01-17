"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Producto, Empresa, DetallePedidoBase, PedidoCreatePayload } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle, Trash2, ArrowLeft, ChevronsUpDown, Package, User } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from '@/lib/utils';

type LineaPedido = {
  producto: Producto;
  cantidad: string;
};

export default function NuevoPedidoPage() {
  const { token, asesor, clients, products, selectedEmpresa, updateEmpresaInState } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [lineasPedido, setLineasPedido] = useState<LineaPedido[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [idPedidoGenerado, setIdPedidoGenerado] = useState<string>('');

  useEffect(() => {
    if (selectedEmpresa) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const nextId = String(selectedEmpresa.idPedido).padStart(3, '0');
        setIdPedidoGenerado(`${year}${month}${day}-${nextId}`);
    } else {
        setIdPedidoGenerado('Seleccione una empresa');
    }
  }, [selectedEmpresa]);

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
      return [...currentLineas, { producto, cantidad: "1" }];
    });
  };

  const handleUpdateCantidad = (idProducto: string, cantidad: string) => {
    if (cantidad === '' || (parseInt(cantidad) > 0)) {
        setLineasPedido(currentLineas =>
          currentLineas.map(linea =>
            linea.producto.idProducto === idProducto ? { ...linea, cantidad: cantidad } : linea
          )
        );
    }
  };
  
  const handleCantidadBlur = (idProducto: string, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1) {
        setLineasPedido(currentLineas =>
            currentLineas.map(linea =>
              linea.producto.idProducto === idProducto ? { ...linea, cantidad: "1" } : linea
            )
          );
    }
  }

  const handleRemoveProducto = (idProducto: string) => {
    setLineasPedido(currentLineas =>
      currentLineas.filter(linea => linea.producto.idProducto !== idProducto)
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

  const handleSavePedido = async () => {
    if (!selectedClientId) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Por favor, seleccione un cliente." });
      return;
    }
    if (lineasPedido.length === 0 || lineasPedido.some(l => !l.cantidad || parseInt(l.cantidad) === 0)) {
      toast({ variant: "destructive", title: "Pedido inválido", description: "Agregue productos y asegúrese de que las cantidades no sean cero." });
      return;
    }
    if (!asesor) {
        toast({ variant: "destructive", title: "Error", description: "No se ha seleccionado un asesor." });
        return;
    }
    if (!selectedEmpresa) {
        toast({ variant: "destructive", title: "Error", description: "No se ha seleccionado una empresa." });
        return;
    }

    setIsSaving(true);
    
    const detallesParaEnviar: DetallePedidoBase[] = lineasPedido.map(linea => ({
        idProducto: linea.producto.idProducto,
        Precio: linea.producto.Precio,
        Cantidad: parseInt(linea.cantidad, 10) || 1,
    }));

    const pedidoPayload: PedidoCreatePayload = {
      idPedido: idPedidoGenerado,
      fechaPedido: new Date().toISOString(),
      totalPedido: totalPedido,
      idAsesor: asesor.idAsesor,
      Status: "Pendiente",
      idCliente: selectedClientId,
      idEmpresa: selectedEmpresa.idEmpresa,
      detalles: detallesParaEnviar,
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
      
      // Increment counter on success
      if (selectedEmpresa) {
        try {
            const incrementResponse = await fetch(`${API_BASE_URL}${API_ROUTES.updateEmpresaPedido}${selectedEmpresa.idEmpresa}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(selectedEmpresa),
            });

            if (incrementResponse.ok) {
                const updatedEmpresaData: Empresa = await incrementResponse.json();
                updateEmpresaInState(updatedEmpresaData);
            } else {
                toast({
                    variant: "destructive",
                    title: "Advertencia de Sincronización",
                    description: "El pedido se guardó, pero el contador de pedidos no pudo actualizarse. Por favor, sincronice manualmente.",
                });
            }
        } catch (e) {
             toast({
                variant: "destructive",
                title: "Error de Sincronización",
                description: "El pedido se guardó, pero hubo un error al actualizar el contador.",
            });
        }
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
    <div className="p-2 space-y-2">
       <div className="flex items-center gap-2">
        <Link href="/pedidos" passHref>
          <Button variant="outline" size="icon">
            <ArrowLeft />
          </Button>
        </Link>
      </div>

      <Card>
          <CardContent className='p-2 space-y-2 text-sm'>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <span className="font-bold text-lg text-primary">{idPedidoGenerado}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                <span>{asesor?.Asesor || 'No seleccionado'}</span>
              </div>
          </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-2">
          <CardTitle className="text-lg">Cliente</CardTitle>
        </CardHeader>
        <CardContent className="p-2 pt-0">
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
        <CardHeader className="p-2">
          <CardTitle className="text-lg">Productos</CardTitle>
        </CardHeader>
        <CardContent className="p-2 pt-0 space-y-4">
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
          <CardHeader className="p-2">
            <CardTitle className="text-lg">Revisar Pedido</CardTitle>
            <CardDescription>Ajuste las cantidades y revise el pedido antes de guardarlo.</CardDescription>
          </CardHeader>
          <CardContent className="p-2 pt-0">
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
                    <TableCell className="p-1">
                        <div className="font-medium">{linea.producto.Producto}</div>
                        <div className="text-sm text-muted-foreground">{formatCurrency(linea.producto.Precio)} c/u</div>
                    </TableCell>
                    <TableCell className="p-1">
                      <Input
                        type="number"
                        value={linea.cantidad}
                        onChange={(e) => handleUpdateCantidad(linea.producto.idProducto, e.target.value)}
                        onBlur={(e) => handleCantidadBlur(linea.producto.idProducto, e.target.value)}
                        className="text-center"
                        min="1"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium p-1">
                      {formatCurrency(linea.producto.Precio * (parseInt(linea.cantidad, 10) || 0))}
                    </TableCell>
                    <TableCell className="p-1">
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveProducto(linea.producto.idProducto)}>
                        <Trash2 className="text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 p-2 pt-2">
            <div className="flex justify-between items-center w-full">
                <div className="text-xl font-bold">
                    Nro. Items: <span className="text-primary">{lineasPedido.length}</span>
                </div>
                <div className="text-xl font-bold">
                    Total: <span className="text-primary">{formatCurrency(totalPedido)}</span>
                </div>
            </div>
            <Button onClick={handleSavePedido} disabled={isSaving} className="w-full">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </CardFooter>
        </Card>
      )}

    </div>
  );
}
