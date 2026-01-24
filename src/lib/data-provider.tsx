"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Asesor, Cliente, Producto, Empresa, Pedido, PedidoCreatePayload, DetallePedido } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from '@/hooks/use-toast';
import { useApiStatus } from '@/hooks/use-api-status';
import { useAuth } from './auth';
import { db } from './db';

const setItem = (key: string, value: any) => {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(value));
    }
}

const getItem = <T>(key: string): T | null => {
    if (typeof localStorage === 'undefined') return null;
    const storedValue = localStorage.getItem(key);
    if (!storedValue) return null;
    try {
        return JSON.parse(storedValue) as T;
    } catch (error) {
        console.error(`Failed to parse item '${key}' from localStorage`, error);
        localStorage.removeItem(key);
        return null;
    }
}

interface DataContextType {
    asesor: Asesor | null;
    asesores: Asesor[];
    clients: Cliente[];
    products: Producto[];
    empresas: Empresa[];
    selectedEmpresa: Empresa | null;
    localPedidos: Pedido[];
    setAsesor: (asesor: Asesor) => void;
    setEmpresa: (empresa: Empresa) => void;
    updateEmpresaInState: (empresa: Empresa) => void;
    syncData: () => Promise<void>;
    addLocalPedido: (pedidoPayload: Omit<PedidoCreatePayload, 'idPedido' | 'fechaPedido' | 'Status'>) => Promise<void>;
    isSyncing: boolean;
    isSyncingLocal: boolean;
    isDataLoading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
    const { token, user, logout } = useAuth();
    const { toast } = useToast();
    const isOnline = useApiStatus();

    const [asesor, setAsesorState] = useState<Asesor | null>(null);
    const [asesores, setAsesores] = useState<Asesor[]>([]);
    const [clients, setClients] = useState<Cliente[]>([]);
    const [products, setProducts] = useState<Producto[]>([]);
    const [empresas, setEmpresas] = useState<Empresa[]>([]);
    const [selectedEmpresa, setSelectedEmpresaState] = useState<Empresa | null>(null);
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [localPedidos, setLocalPedidos] = useState<Pedido[]>([]);
    const [isSyncingLocal, setIsSyncingLocal] = useState(false);

    const fetchClientsForAsesor = useCallback(async (asesorId: string, currentToken: string) => {
        if (!currentToken) return;
        try {
            const url = new URL(`${API_BASE_URL}${API_ROUTES.clientes}`);
            url.searchParams.append('id_asesor', asesorId);
            const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${currentToken}` } });
            if (response.status === 401) throw new Error("401");
            if (!response.ok) throw new Error('No se pudieron cargar los clientes.');
            const clientesData: Cliente[] = await response.json();
            setClients(clientesData);
            setItem('clients', clientesData);
        } catch (error) {
            if (error instanceof Error && error.message === "401") {
                toast({ variant: "destructive", title: "Sesión expirada" });
                logout();
            } else {
                console.error("Error fetching clients:", error)
                toast({ variant: "destructive", title: "Error al Cargar Clientes", description: "No se pudieron cargar los clientes. Intente sincronizar de nuevo." });
            }
        }
    }, [toast, logout]);
    
    const syncData = useCallback(async (tokenOverride?: string) => {
        const currentToken = tokenOverride || token;
        if (!currentToken) return;
        setIsSyncing(true);
        try {
          const responses = await Promise.all([
            fetch(`${API_BASE_URL}${API_ROUTES.productos}`, { headers: { Authorization: `Bearer ${currentToken}` } }),
            fetch(`${API_BASE_URL}${API_ROUTES.empresas}`, { headers: { Authorization: `Bearer ${currentToken}` } }),
            fetch(`${API_BASE_URL}${API_ROUTES.asesores}`, { headers: { Authorization: `Bearer ${currentToken}` } }),
          ]);
          if (responses.some(res => res.status === 401)) throw new Error("401");
          const [productosRes, empresasRes, asesoresRes] = responses;
          if (!productosRes.ok || !empresasRes.ok || !asesoresRes.ok) throw new Error('Error al sincronizar datos.');
    
          const productosData: Producto[] = await productosRes.json();
          setProducts(productosData); setItem('products', productosData);
          const empresasData: Empresa[] = await empresasRes.json();
          setEmpresas(empresasData); setItem('empresas', empresasData);
          const asesoresData: Asesor[] = await asesoresRes.json();
          setAsesores(asesoresData); setItem('asesores', asesoresData);
          
          const localAsesor = getItem<Asesor>('asesor');
          if(localAsesor) {
            const freshAsesor = asesoresData.find(a => a.idAsesor === localAsesor.idAsesor);
            if (freshAsesor) await fetchClientsForAsesor(freshAsesor.idAsesor, currentToken);
          }
        } catch (error) {
          if (error instanceof Error && error.message === "401") {
            toast({ variant: "destructive", title: "Sesión expirada" });
            logout();
          } else {
            toast({ variant: "destructive", title: "Error de Sincronización", description: error instanceof Error ? error.message : "No se pudieron cargar los datos." });
          }
        } finally {
          setIsSyncing(false);
        }
      }, [token, toast, logout, fetchClientsForAsesor]);


    const loadInitialData = useCallback(async () => {
        if (!user || !token) return; 
        setIsDataLoading(true);

        const cachedAsesor = getItem<Asesor>('asesor');
        const cachedEmpresa = getItem<Empresa>('empresa');
        const cachedProducts = getItem<Producto[]>('products') || [];
        const cachedEmpresas = getItem<Empresa[]>('empresas') || [];
        const cachedAsesores = getItem<Asesor[]>('asesores') || [];
        const cachedClients = getItem<Cliente[]>('clients') || [];

        setAsesorState(cachedAsesor);
        setSelectedEmpresaState(cachedEmpresa);
        setProducts(cachedProducts);
        setEmpresas(cachedEmpresas);
        setAsesores(cachedAsesores);
        setClients(cachedClients);
        
        if (cachedProducts.length === 0 || cachedEmpresas.length === 0 || cachedAsesores.length === 0) {
            await syncData(token);
        }

        const allAsesores = getItem<Asesor[]>('asesores') || [];
        if (user.idRol !== 'admin' && allAsesores.length > 0 && !cachedAsesor) {
            const match = allAsesores.find(a => a.idAsesor.toLowerCase() === user.username.toLowerCase());
            if (match) {
                setAsesorState(match);
                setItem('asesor', match);
                if (cachedClients.length === 0) {
                    await fetchClientsForAsesor(match.idAsesor, token);
                }
            }
        }
        
        setIsDataLoading(false);
    }, [user, token, syncData, fetchClientsForAsesor]);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);


    const setAsesor = useCallback((asesorToSet: Asesor) => {
        setAsesorState(asesorToSet);
        setItem('asesor', asesorToSet);
        if (token) {
            fetchClientsForAsesor(asesorToSet.idAsesor, token);
        }
    }, [token, fetchClientsForAsesor]);

    const setEmpresa = (empresaToSet: Empresa) => {
        setSelectedEmpresaState(empresaToSet);
        setItem('empresa', empresaToSet);
    };

    const updateEmpresaInState = (updatedEmpresa: Empresa) => {
        const updatedEmpresas = empresas.map(e => e.idEmpresa === updatedEmpresa.idEmpresa ? updatedEmpresa : e);
        setEmpresas(updatedEmpresas);
        setItem('empresas', updatedEmpresas);
        if (selectedEmpresa?.idEmpresa === updatedEmpresa.idEmpresa) {
            setEmpresa(updatedEmpresa);
        }
    };
    
    const findAndReserveNextPedidoId = useCallback(async (): Promise<string | null> => {
        if (!token || !selectedEmpresa) return null;
        
        let nextIdPedidoToTry = selectedEmpresa.idPedido;
        let attempts = 0;

        while (attempts < 20) {
            attempts++;
            
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const nextId = String(nextIdPedidoToTry).padStart(3, '0');
            const candidateId = `${year}${month}${day}-${nextId}`;

            try {
                const checkResponse = await fetch(`${API_BASE_URL}${API_ROUTES.pedidos}${candidateId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (checkResponse.ok) {
                    nextIdPedidoToTry++;
                    continue;
                }

                if (checkResponse.status === 404) {
                    const newCounterValue = nextIdPedidoToTry + 1;
                    const updateResponse = await fetch(`${API_BASE_URL}${API_ROUTES.updateEmpresaPedido}${selectedEmpresa.idEmpresa}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ idPedido: newCounterValue }),
                    });

                    if (updateResponse.ok) {
                        const updatedEmpresa = await updateResponse.json();
                        updateEmpresaInState(updatedEmpresa);
                        return candidateId;
                    } else {
                         nextIdPedidoToTry++;
                         continue;
                    }
                }
                
                toast({ variant: 'destructive', title: 'Error de Red', description: 'No se pudo verificar el ID del pedido.' });
                return null;

            } catch (error) {
                toast({ variant: "destructive", title: "Error de Conexión", description: "No se pudo comunicar con el servidor para obtener un ID de pedido." });
                return null;
            }
        }

        toast({ variant: "destructive", title: "No se pudo asignar ID", description: "No se pudo encontrar un ID de pedido disponible después de varios intentos." });
        return null;
    }, [token, selectedEmpresa, updateEmpresaInState, toast]);

    const addLocalPedido = useCallback(async (
        pedidoPayload: Omit<PedidoCreatePayload, 'idPedido' | 'fechaPedido' | 'Status'>
    ) => {
        if (!user) return;
        const lastLocalPedido = await db.localPedidos.orderBy('idPedido').last();
        let nextIdNum = 1;
        if (lastLocalPedido) {
            try {
                const lastIdNum = parseInt(lastLocalPedido.idPedido.split('-')[1]);
                if (!isNaN(lastIdNum)) nextIdNum = lastIdNum + 1;
            } catch (e) {}
        }

        const tempId = `L-${String(nextIdNum).padStart(3, '0')}`;
        const now = new Date();

        const detallesConTotal: DetallePedido[] = pedidoPayload.detalles.map((d, index) => ({
            ...d, id: `local-${now.getTime()}-${index}`, idPedido: tempId,
            Total: d.Cantidad * d.Precio, createdAt: now.toISOString(), updatedAt: now.toISOString(),
            createdBy: user.username, updatedBy: user.username,
        }));

        const newLocalPedido: Pedido = {
          ...pedidoPayload, idPedido: tempId, fechaPedido: now.toISOString(),
          Status: 'Local', detalles: detallesConTotal, createdAt: now.toISOString(),
          updatedAt: now.toISOString(), createdBy: user.username, updatedBy: user.username,
          isLocal: true,
        };
        
        await db.localPedidos.add(newLocalPedido);
        const allLocalPedidos = await db.localPedidos.orderBy('createdAt').reverse().toArray();
        setLocalPedidos(allLocalPedidos);

        toast({ title: "Pedido Guardado Localmente", description: `El pedido ${tempId} se sincronizará cuando haya conexión.` });

    }, [user, toast]);

    const loadLocalPedidosFromDb = useCallback(async () => {
        const localPedidosFromDb = await db.localPedidos.orderBy('createdAt').reverse().toArray();
        setLocalPedidos(localPedidosFromDb);
    }, []);
    
    const syncLocalPedidos = useCallback(async () => {
        const pedidosToSync = await db.localPedidos.toArray();
        if (pedidosToSync.length === 0 || !isOnline || !token) return;

        const confirmSync = window.confirm(`Tiene ${pedidosToSync.length} pedido(s) locales. ¿Desea sincronizarlos ahora?`);
        if (!confirmSync) return;
    
        setIsSyncingLocal(true);
        toast({ title: 'Iniciando sincronización de pedidos locales...' });
        
        let successCount = 0;
    
        for (const localPedido of pedidosToSync) {
            try {
                const reservedId = await findAndReserveNextPedidoId();
                if (!reservedId) throw new Error(`No se pudo reservar un ID para el pedido ${localPedido.idPedido}`);
                
                const pedidoPayload: PedidoCreatePayload = {
                  idPedido: reservedId, idEmpresa: localPedido.idEmpresa, fechaPedido: localPedido.fechaPedido,
                  totalPedido: localPedido.totalPedido, idAsesor: localPedido.idAsesor, idCliente: localPedido.idCliente,
                  Status: "Pendiente",
                  detalles: localPedido.detalles.map(d => ({ Cantidad: d.Cantidad, Precio: d.Precio, idProducto: d.idProducto })),
                };
    
                const response = await fetch(`${API_BASE_URL}${API_ROUTES.pedidos}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(pedidoPayload),
                });
    
                if (response.status === 401) throw new Error("401");
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error(`Error al sincronizar pedido ${localPedido.idPedido}: ${errorData.detail || 'Error desconocido'}`);
                    throw new Error(`Error al sincronizar pedido ${localPedido.idPedido}: ${errorData.detail || 'Error desconocido'}`);
                }
                
                await db.localPedidos.delete(localPedido.idPedido);
                successCount++;
    
            } catch (error) {
                console.error(`Failed to sync order ${localPedido.idPedido}:`, error);
                 if (error instanceof Error && error.message === "401") {
                    toast({ variant: "destructive", title: "Sesión expirada" });
                    logout();
                    setIsSyncingLocal(false);
                    return;
                }
                toast({ variant: "destructive", title: "Error de Sincronización", description: `Fallo al sincronizar pedido ${localPedido.idPedido}. Proceso detenido.` });
                break;
            }
        }
    
        const remainingLocalPedidos = await db.localPedidos.toArray();
        setLocalPedidos(remainingLocalPedidos);
        setIsSyncingLocal(false);

        if (successCount > 0) {
            toast({ title: "Sincronización Completada", description: `${successCount} pedido(s) se han sincronizado.` });
        }
    
    }, [isOnline, token, findAndReserveNextPedidoId, toast, logout]);

    useEffect(() => {
        loadLocalPedidosFromDb();
    }, [loadLocalPedidosFromDb]);
    
    useEffect(() => {
      const checkAndPromptSync = async () => {
          if (isOnline) {
              const count = await db.localPedidos.count();
              if (count > 0 && !isSyncingLocal) {
                  syncLocalPedidos();
              }
          }
      }
      const interval = setInterval(checkAndPromptSync, 60000); // Check every minute
      checkAndPromptSync();
      return () => clearInterval(interval);
    }, [isOnline, isSyncingLocal, syncLocalPedidos]);

    return (
        <DataContext.Provider value={{ 
            asesor, asesores, clients, products, empresas, selectedEmpresa, localPedidos, 
            setAsesor, setEmpresa, updateEmpresaInState, syncData, addLocalPedido, 
            isSyncing, isSyncingLocal, isDataLoading
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) throw new Error('useData must be used within a DataProvider');
    return context;
};
