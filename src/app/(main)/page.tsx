"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data-provider';
import { Pedido } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, AlertCircle, Send, Printer, Edit, WifiOff, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusConfig: { [key: string]: { icon: React.ElementType; color: string; textColor: string } } = {
  Pendiente: { icon: AlertCircle, color: 'hsl(var(--destructive))', textColor: 'text-destructive' },
  Enviado: { icon: Send, color: 'hsl(var(--success))', textColor: 'text-success' },
  Impreso: { icon: Printer, color: 'hsl(var(--info))', textColor: 'text-info' },
  Modificado: { icon: Edit, color: 'hsl(var(--accent))', textColor: 'text-accent' },
  Local: { icon: WifiOff, color: 'hsl(var(--warning))', textColor: 'text-warning' },
};

export default function DashboardPage() {
  const { token, logout } = useAuth();
  const { asesor, pedidosLocales, isDataLoading } = useData();
  const { toast } = useToast();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAllPedidos = useCallback(async (asesorId: string) => {
    if (!token) return;
    setIsLoading(true);
    let allPedidos: Pedido[] = [];
    let page = 1;
    const limit = 100;
    let hasMore = true;

    try {
      while (hasMore) {
        const offset = (page - 1) * limit;
        const url = new URL(`${API_BASE_URL}${API_ROUTES.pedidos}`);
        url.searchParams.append('id_asesor', asesorId);
        url.searchParams.append('offset', String(offset));
        url.searchParams.append('limit', String(limit));

        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
          toast({ variant: 'destructive', title: 'Sesión expirada', description: 'Por favor inicie sesión de nuevo.' });
          logout();
          hasMore = false;
          return;
        }
        if (!response.ok) throw new Error('No se pudieron cargar los pedidos para el resumen.');

        const newPedidos: Pedido[] = await response.json();
        allPedidos = [...allPedidos, ...newPedidos];
        
        if (newPedidos.length < limit) {
          hasMore = false;
        } else {
          page++;
        }
      }
      setPedidos(allPedidos);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error de Carga",
        description: error instanceof Error ? error.message : "Ocurrió un error al cargar los datos del resumen.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [token, toast, logout]);

  useEffect(() => {
    if (asesor?.idAsesor) {
      fetchAllPedidos(asesor.idAsesor);
    } else if (!isDataLoading) {
      setIsLoading(false);
    }
  }, [asesor, isDataLoading, fetchAllPedidos]);
  
  const summary = useMemo(() => {
    const combinedPedidos = [...pedidos, ...pedidosLocales];
    const initialSummary: { [key: string]: { count: number; total: number } } = {
      Pendiente: { count: 0, total: 0 },
      Enviado: { count: 0, total: 0 },
      Impreso: { count: 0, total: 0 },
      Modificado: { count: 0, total: 0 },
      Local: { count: 0, total: 0 },
      Total: { count: 0, total: 0 }
    };
    
    return combinedPedidos.reduce((acc, pedido) => {
        const status = pedido.isLocal ? 'Local' : (pedido.Status || 'Pendiente');
        const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

        if (acc[normalizedStatus]) {
            acc[normalizedStatus].count++;
            acc[normalizedStatus].total += pedido.totalPedido;
        }
        acc.Total.count++;
        acc.Total.total += pedido.totalPedido;
        return acc;
    }, initialSummary);
  }, [pedidos, pedidosLocales]);

  const chartData = useMemo(() => {
    return Object.entries(summary)
      .filter(([key]) => key !== 'Total' && summary[key].count > 0)
      .map(([name, data]) => ({
        name,
        Pedidos: data.count,
        fill: statusConfig[name as keyof typeof statusConfig]?.color || '#8884d8'
      }));
  }, [summary]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }

  if (isLoading || isDataLoading) {
    return (
      <div className="flex-grow flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-3xl font-bold font-headline text-primary">Resumen de Pedidos</h1>
      
      <div className="grid grid-cols-2 gap-4">
        <Card className="col-span-2 bg-primary/10 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Totales</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.Total.count}</div>
            <p className="text-xs text-muted-foreground">
              Monto total de {formatCurrency(summary.Total.total)}
            </p>
          </CardContent>
        </Card>
        
        {Object.entries(summary).filter(([key]) => key !== 'Total' && key in statusConfig).map(([status, data]) => {
          if (data.count === 0) return null;
          const config = statusConfig[status as keyof typeof statusConfig];
          const Icon = config.icon;
          return (
            <Card key={status}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{status}</CardTitle>
                <Icon className={cn("h-4 w-4 text-muted-foreground", config.textColor)} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.count}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(data.total)}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribución de Pedidos</CardTitle>
          <CardDescription>Cantidad de pedidos por estado.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false}/>
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip 
                    cursor={{fill: 'hsl(var(--muted))'}}
                    contentStyle={{ 
                        backgroundColor: "hsl(var(--background))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "var(--radius)"
                    }}
                />
                <Bar dataKey="Pedidos" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
