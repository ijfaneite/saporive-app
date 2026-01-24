"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '@/lib/data-provider';
import { Producto, Pedido, DetallePedidoBase, PedidoCreatePayload } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle, Trash2, ChevronsUpDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';
import { getStatusVariant } from '@/lib/status-config';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type LineaPedido = {
  id: string; 
  producto: Producto;
  cantidad: string;
};

interface PedidoFormProps {
    mode: 'nuevo' | 'editar' | 'consultar';
    initialPedido?: Pedido | null;
    idPedidoGenerado?: string;
    onSave: (payload: PedidoCreatePayload) => Promise<void>;
    isSaving: boolean;
}

export function PedidoForm({ mode, initialPedido, idPedidoGenerado, onSave, isSaving }: PedidoFormProps) {
    const { clientes, productos, selectedEmpresa, asesor: loggedInAsesor, asesores } = useData();
    const { toast } = useToast();

    const isViewMode = mode === 'consultar';

    const [lineasPedido, setLineasPedido] = useState<LineaPedido[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    
    useEffect(() => {
        if (initialPedido) {
            setSelectedClientId(initialPedido.idCliente);
            const lineas = initialPedido.detalles.map(detalle => {
                const producto = productos.find(p => p.idProducto === detalle.idProducto);
                return {
                  id: detalle.id,
                  producto: producto || { 
                      idProducto: detalle.idProducto, 
                      Producto: `(No disponible) ID: ${detalle.idProducto}`, 
                      Precio: detalle.Precio,
                    },
                  cantidad: String(detalle.Cantidad),
                };
            });
            setLineasPedido(lineas);
        }
    }, [initialPedido, productos]);
    
    // Client Combobox states
    const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
    const [clientSearch, setClientSearch] = useState("");

    const filteredClients = useMemo(() => {
        if (!loggedInAsesor) return [];
        const allAsesorClients = clientes.filter(c => c.idAsesor === loggedInAsesor.idAsesor);
        if (!clientSearch) return allAsesorClients;
        const lowercasedTerm = clientSearch.toLowerCase();
        return allAsesorClients.filter(c => 
            c.Cliente.toLowerCase().includes(lowercasedTerm) || 
            c.Rif.toLowerCase().includes(lowercasedTerm) ||
            c.Zona.toLowerCase().includes(lowercasedTerm)
        );
    }, [clientes, loggedInAsesor, clientSearch]);

    // Product Combobox states
    const [productPopoverOpen, setProductPopoverOpen] = useState(false);
    const [productSearch, setProductSearch] = useState("");

    const filteredProducts = useMemo(() => {
        if (!productSearch) return productos;
        return productos.filter(p => p.Producto.toLowerCase().includes(productSearch.toLowerCase()));
    }, [productos, productSearch]);

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
    
    const handleSaveClick = () => {
        if (!selectedClientId) {
          toast({ variant: "destructive", title: "Faltan datos", description: "Por favor, seleccione un cliente." });
          return;
        }
        if (lineasPedido.length === 0 || lineasPedido.some(l => !l.cantidad || parseInt(l.cantidad) === 0)) {
          toast({ variant: "destructive", title: "Pedido inválido", description: "Agregue productos y asegúrese de que las cantidades no sean cero." });
          return;
        }
        if (!loggedInAsesor || !selectedEmpresa) {
            toast({ variant: "destructive", title: "Error de configuración", description: "No se ha seleccionado un asesor o una empresa." });
            return;
        }
    
        const detallesParaEnviar: DetallePedidoBase[] = lineasPedido.map(linea => ({
            idProducto: linea.producto.idProducto,
            Precio: linea.producto.Precio,
            Cantidad: parseInt(linea.cantidad, 10) || 1,
        }));
    
        const pedidoPayload: PedidoCreatePayload = {
          idPedido: mode === 'nuevo' ? idPedidoGenerado! : initialPedido!.idPedido,
          fechaPedido: new Date().toISOString(),
          totalPedido: totalPedido,
          idAsesor: mode === 'nuevo' ? loggedInAsesor.idAsesor : initialPedido!.idAsesor,
          Status: mode === 'nuevo' ? "Pendiente" : "Modificado",
          idCliente: selectedClientId,
          idEmpresa: selectedEmpresa.idEmpresa,
          detalles: detallesParaEnviar,
        };

        onSave(pedidoPayload);
    };

    const selectedClient = useMemo(() => {
        if (!selectedClientId) return null;
        return clientes.find(c => c.idCliente === selectedClientId) ?? null;
      }, [selectedClientId, clientes]);
    
    const pedidoAsesor = useMemo(() => {
        if (mode !== 'nuevo' && initialPedido) {
            return asesores.find(a => a.idAsesor === initialPedido.idAsesor);
        }
        return loggedInAsesor;
    }, [mode, initialPedido, asesores, loggedInAsesor]);

    const fechaDelPedido = useMemo(() => {
        return initialPedido ? new Date(initialPedido.fechaPedido) : new Date();
    }, [initialPedido]);

    const horaUltimaActualizacion = useMemo(() => {
        return initialPedido ? new Date(initialPedido.updatedAt) : new Date();
    }, [initialPedido]);

    const statusDelPedido = useMemo(() => {
        if (mode === 'nuevo') return 'Pendiente';
        return initialPedido?.Status || 'Desconocido';
    }, [mode, initialPedido]);

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className='p-3 text-sm'>
                    <div className="grid grid-cols-[1fr_auto] gap-x-4">
                        {/* Left side */}
                        <div className="min-w-0 flex-grow space-y-1 self-center">
                            <p className="font-bold text-lg text-foreground truncate">{mode === 'nuevo' ? idPedidoGenerado : initialPedido?.idPedido}</p>
                            <p className="text-sm font-medium truncate">{selectedClient ? selectedClient.Cliente : 'Sin cliente'}</p>
                            {selectedClient && (
                                <>
                                    <p className="text-xs text-muted-foreground truncate">{selectedClient.Rif}</p>
                                    <p className="text-xs text-muted-foreground truncate">{selectedClient.Zona}</p>
                                </>
                            )}
                            {pedidoAsesor && (
                                <p className="text-xs text-muted-foreground truncate">{pedidoAsesor.Asesor}</p>
                            )}
                        </div>

                        {/* Right side */}
                        <div className="flex flex-col items-end gap-1 text-right">
                            <Badge variant={getStatusVariant(statusDelPedido)}>{statusDelPedido}</Badge>
                            <span className="text-xs">{format(fechaDelPedido, "dd/MMM/yyyy", { locale: es })}</span>
                            <span className="text-xs text-muted-foreground">{format(horaUltimaActualizacion, "h:mm a", { locale: es })}</span>
                        </div>
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
                    <Button variant="outline" role="combobox" aria-expanded={clientPopoverOpen} className="w-full justify-between font-normal bg-[hsl(var(--input-background))]" disabled={isViewMode}>
                        <span className='truncate'>{selectedClient?.Cliente ?? "Seleccione un cliente..."}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <div className='p-2 border-b'>
                        <Input 
                            placeholder="Buscar cliente por nombre, RIF o Zona..." 
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <ScrollArea className="h-56">
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
                {!isViewMode && (
                    <CardContent className="p-2 pt-0 space-y-4">
                        <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start font-normal bg-[hsl(var(--input-background))]">
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
                                <ScrollArea className="h-56">
                                    <div className="p-1">
                                    {filteredProducts.length > 0 ? filteredProducts.map(p => {
                                        const isAdded = lineasPedido.some(linea => linea.producto.idProducto === p.idProducto);
                                        return (
                                        <div key={p.idProducto} 
                                            className={cn(
                                                "flex items-center justify-between p-2 rounded-sm",
                                                isAdded 
                                                    ? "opacity-50 cursor-not-allowed" 
                                                    : "cursor-pointer hover:bg-muted"
                                            )}
                                            onClick={() => {
                                                if (isAdded) return;
                                                handleAddProducto(p);
                                                setProductPopoverOpen(false);
                                                setProductSearch("");
                                            }}
                                        >
                                            <div>
                                                <p className="font-semibold text-sm">{p.Producto}</p>
                                                <p className="text-xs text-muted-foreground">{formatCurrency(p.Precio)}</p>
                                            </div>
                                            <PlusCircle className={cn("h-5 w-5", isAdded ? "text-muted-foreground" : "text-primary")} />
                                        </div>
                                    )}) : <p className="text-center text-sm text-muted-foreground p-4">No se encontraron productos.</p>}
                                    </div>
                                </ScrollArea>
                            </PopoverContent>
                        </Popover>
                    </CardContent>
                )}
            </Card>

            {lineasPedido.length > 0 && (
                <Card>
                <CardHeader className="p-2">
                    <CardTitle className="text-lg">Revisar Pedido</CardTitle>
                    {!isViewMode && <CardDescription>Ajuste las cantidades y revise el pedido antes de guardarlo.</CardDescription>}
                </CardHeader>
                <CardContent className="p-2 pt-0">
                    <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="font-bold text-primary">Producto</TableHead>
                            <TableHead className="w-24 text-center font-bold text-primary">Cantidad</TableHead>
                            <TableHead className="text-right font-bold text-primary">Subtotal</TableHead>
                            {!isViewMode && <TableHead className="w-12"></TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {lineasPedido.map(linea => (
                        <TableRow key={linea.id}>
                            <TableCell className="p-1">
                                <div className={cn("font-medium", linea.producto.Producto.startsWith('(No disponible)') && 'text-destructive')}>
                                    {linea.producto.Producto}
                                </div>
                                <div className="text-sm text-muted-foreground">{formatCurrency(linea.producto.Precio)} c/u</div>
                            </TableCell>
                            <TableCell className="p-1">
                            <Input
                                type="number"
                                value={linea.cantidad}
                                onChange={(e) => handleUpdateCantidad(linea.id, e.target.value)}
                                onBlur={(e) => handleCantidadBlur(linea.id, e.target.value)}
                                className="text-center"
                                min="1"
                                disabled={isViewMode}
                            />
                            </TableCell>
                            <TableCell className="text-right font-medium p-1">
                            {formatCurrency(linea.producto.Precio * (parseInt(linea.cantidad, 10) || 0))}
                            </TableCell>
                            {!isViewMode && (
                                <TableCell className="p-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveProducto(linea.id)}>
                                        <Trash2 className="text-destructive" />
                                    </Button>
                                </TableCell>
                            )}
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
                            Total: <span className="text-foreground">{formatCurrency(totalPedido)}</span>
                        </div>
                    </div>
                    {!isViewMode && (
                        <Button onClick={handleSaveClick} disabled={isSaving} className="w-full">
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {mode === 'nuevo' ? 'Guardar' : 'Guardar Cambios'}
                        </Button>
                    )}
                </CardFooter>
                </Card>
            )}
        </div>
    )
}
