"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Asesor, Cliente, Producto, Empresa, Pedido, PedidoCreatePayload, DetallePedido } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from '@/hooks/use-toast';
import { useApiStatus } from '@/hooks/use-api-status';
import { useAuth } from './auth';
import { db } from './db';


interface DataContextType {
    asesor: Asesor | null;
    asesores: Asesor[];
    clientes: Cliente[];
    productos: Producto[];
    empresas: Empresa[];
    selectedEmpresa: Empresa | null;
    pedidosLocales: Pedido[];
    findAndReserveNextPedidoId: () => Promise<string | null>;
    setAsesor: (asesor: Asesor) => void;
    setEmpresa: (empresa: Empresa) => void;
    updateEmpresaInState: (empresa: Empresa) => Promise<void>;
    syncData: () => Promise<void>;
    addLocalPedido: (pedidoPayload: Omit<PedidoCreatePayload, 'idPedido' | 'fechaPedido' | 'Status'>) => Promise<void>;
    isSyncing: boolean;
    isSyncingLocal: boolean;
    isDataLoading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
    const { token, user, logout, isLoading: isAuthLoading } = useAuth();
    const { toast } = useToast();
    const isOnline = useApiStatus();

    const [asesor, setAsesorState] = useState<Asesor | null>(null);
    const [asesores, setAsesores] = useState<Asesor[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [productos, setProductos] = useState<Producto[]>([]);
    const [empresas, setEmpresas] = useState<Empresa[]>([]);
    const [selectedEmpresa, setSelectedEmpresaState] = useState<Empresa | null>(null);
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pedidosLocales, setPedidosLocales] = useState<Pedido[]>([]);
    const [isSyncingLocal, setIsSyncingLocal] = useState(false);

    const fetchClientesForAsesor = useCallback(async (asesorId: string) => {
        if (!token || !isOnline) return;
        try {
            const url = new URL(`${API_BASE_URL}${API_ROUTES.clientes}`);
            url.searchParams.append('id_asesor', asesorId);
            const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
            if (response.status === 401) throw new Error("401");
            if (!response.ok) throw new Error('No se pudieron cargar los clientes.');
            const clientesData: Cliente[] = await response.json();
            await db.clientes.bulkPut(clientesData);
            setClientes(clientesData);
        } catch (error) {
            if (error instanceof Error && error.message === "401") {
                toast({ variant: "destructive", title: "Sesión expirada" });
                logout();
            } else if (isOnline) {
                console.error("Error fetching clients:", error)
                toast({ variant: "destructive", title: "Error al Cargar Clientes", description: "No se pudieron cargar los clientes. Intente sincronizar de nuevo." });
            }
        }
    }, [token, toast, logout, isOnline]);
    
    const syncData = useCallback(async () => {
        if (!token || !isOnline) return;
        setIsSyncing(true);
        try {
          const responses = await Promise.all([
            fetch(`${API_BASE_URL}${API_ROUTES.productos}`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_BASE_URL}${API_ROUTES.empresas}`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_BASE_URL}${API_ROUTES.asesores}`, { headers: { Authorization: `Bearer ${token}` } }),
          ]);
          if (responses.some(res => res.status === 401)) throw new Error("401");
          const [productosRes, empresasRes, asesoresRes] = responses;
          if (!productosRes.ok || !empresasRes.ok || !asesoresRes.ok) throw new Error('Error al sincronizar datos.');
    
          const productosData: Producto[] = await productosRes.json();
          await db.productos.bulkPut(productosData);
          setProductos(productosData);
          
          const empresasData: Empresa[] = await empresasRes.json();
          await db.empresas.bulkPut(empresasData);
          setEmpresas(empresasData);

          const asesoresData: Asesor[] = await asesoresRes.json();
          await db.asesores.bulkPut(asesoresData);
          setAsesores(asesoresData);
          
          const configAsesor = await db.config.get('asesor');
          const localAsesor = configAsesor?.value as Asesor | null;

          if(localAsesor) {
            const freshAsesor = asesoresData.find(a => a.idAsesor === localAsesor.idAsesor);
            if (freshAsesor) await fetchClientesForAsesor(freshAsesor.idAsesor);
          }
        } catch (error) {
          if (error instanceof Error && error.message === "401") {
            toast({ variant: "destructive", title: "Sesión expirada" });
            logout();
          } else if (isOnline) {
            toast({ variant: "destructive", title: "Error de Sincronización", description: error instanceof Error ? error.message : "No se pudieron cargar los datos." });
          }
        } finally {
          setIsSyncing(false);
        }
      }, [token, toast, logout, fetchClientesForAsesor, isOnline]);


    const setAsesor = useCallback(async (asesorToSet: Asesor) => {
        setAsesorState(asesorToSet);
        await db.config.put({ key: 'asesor', value: asesorToSet });
        if (token && isOnline) {
            await fetchClientesForAsesor(asesorToSet.idAsesor);
        }
    }, [token, fetchClientesForAsesor, isOnline]);

    useEffect(() => {
        const loadAppData = async () => {
            if (isAuthLoading || !user) {
                if(!isAuthLoading) setIsDataLoading(false);
                return;
            }

            setIsDataLoading(true);

            // Step 1: Load all data from IndexedDB unconditionally.
            const [configAsesor, configEmpresa, cachedProductos, cachedEmpresas, cachedAsesores, cachedClientes] = await Promise.all([
                db.config.get('asesor'),
                db.config.get('empresa'),
                db.productos.toArray(),
                db.empresas.toArray(),
                db.asesores.toArray(),
                db.clientes.toArray(),
            ]);

            const localAsesor = configAsesor?.value as Asesor | null;
            const localEmpresa = configEmpresa?.value as Empresa | null;

            // Step 2: Set the application state with the data from IndexedDB.
            setAsesorState(localAsesor);
            setSelectedEmpresaState(localEmpresa);
            setProductos(cachedProductos);
            setEmpresas(cachedEmpresas);
            setAsesores(cachedAsesores);
            setClientes(cachedClientes);
            
            // Step 3: If online, perform network operations (syncing, fetching missing data).
            if (isOnline) {
                const needsMasterSync = cachedProductos.length === 0 || cachedEmpresas.length === 0 || cachedAsesores.length === 0;
                if (needsMasterSync) {
                    await syncData();
                } else if (localAsesor && cachedClientes.length === 0) {
                    // if master data is present, just fetch clients if needed
                    await fetchClientesForAsesor(localAsesor.idAsesor);
                }
            }

            // Step 4: Setup default advisor for non-admin users if not already configured.
            // This logic runs with data from DB, regardless of online status.
            const currentAsesores = await db.asesores.toArray();
            if (user.idRol !== 'admin' && currentAsesores.length > 0 && !localAsesor) {
                const match = currentAsesores.find(a => a.idAsesor.toLowerCase() === user.username.toLowerCase());
                if (match) {
                    await setAsesor(match);
                }
            }
            
            setIsDataLoading(false);
        };
        
        loadAppData();
    }, [user, token, isAuthLoading, isOnline, syncData, fetchClientesForAsesor, setAsesor]);

    const setEmpresa = async (empresaToSet: Empresa) => {
        setSelectedEmpresaState(empresaToSet);
        await db.config.put({ key: 'empresa', value: empresaToSet });
    };

    const updateEmpresaInState = async (updatedEmpresa: Empresa) => {
        const updatedEmpresas = empresas.map(e => e.idEmpresa === updatedEmpresa.idEmpresa ? updatedEmpresa : e);
        setEmpresas(updatedEmpresas);
        await db.empresas.bulkPut(updatedEmpresas);
        if (selectedEmpresa?.idEmpresa === updatedEmpresa.idEmpresa) {
            await setEmpresa(updatedEmpresa);
        }
    };
    
    const findAndReserveNextPedidoId = useCallback(async (): Promise<string | null> => {
        if (!token || !selectedEmpresa) return null;
    
        let nextIdCounter = selectedEmpresa.idPedido + 1;
        let attempts = 0;
        const MAX_ATTEMPTS = 50;
    
        while (attempts < MAX_ATTEMPTS) {
            attempts++;
            
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const nextIdStr = String(nextIdCounter).padStart(3, '0');
            const candidateId = `${year}${month}${day}-${nextIdStr}`;
    
            try {
                const checkResponse = await fetch(`${API_BASE_URL}${API_ROUTES.pedidos}${candidateId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
    
                if (checkResponse.status === 404) {
                    const updateResponse = await fetch(`${API_BASE_URL}${API_ROUTES.updateEmpresaPedido}${selectedEmpresa.idEmpresa}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ idPedido: nextIdCounter }),
                    });
    
                    if (updateResponse.ok) {
                        const updatedEmpresa = await updateResponse.json();
                        await updateEmpresaInState(updatedEmpresa);
                        return candidateId;
                    } else {
                        toast({ variant: 'destructive', title: 'Error de Servidor', description: 'No se pudo actualizar el correlativo del pedido en el servidor. Reintentando...' });
                        await new Promise(resolve => setTimeout(resolve, 500));
                        nextIdCounter++;
                        continue;
                    }
                } else if (checkResponse.ok) {
                    nextIdCounter++;
                    continue;
                }
                
                toast({ variant: 'destructive', title: 'Error de Red', description: `No se pudo verificar el ID del pedido. (Estatus: ${checkResponse.status})` });
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
        const allLocalPedidos = await db.pedidos.where('isLocal').equals(1).toArray();
        const lastIdNum = allLocalPedidos.reduce((max, p) => {
            try {
                const num = parseInt(p.idPedido.split('-')[1]);
                return num > max ? num : max;
            } catch {
                return max;
            }
        }, 0);
        
        const nextIdNum = lastIdNum + 1;
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
          isLocal: 1,
        };
        
        await db.pedidos.add(newLocalPedido);
        const updatedLocalPedidos = await db.pedidos.where('isLocal').equals(1).reverse().sortBy('createdAt');
        setPedidosLocales(updatedLocalPedidos);

        toast({ title: "Pedido Guardado Localmente", description: `El pedido ${tempId} se sincronizará cuando haya conexión.` });

    }, [user, toast]);

    const loadPedidosLocalesFromDb = useCallback(async () => {
        const localPedidosFromDb = await db.pedidos.where('isLocal').equals(1).reverse().sortBy('createdAt');
        setPedidosLocales(localPedidosFromDb);
    }, []);
    
    const syncLocalPedidos = useCallback(async () => {
        const pedidosToSync = await db.pedidos.where('isLocal').equals(1).toArray();
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
                
                await db.pedidos.delete(localPedido.idPedido);
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
    
        const remainingLocalPedidos = await db.pedidos.where('isLocal').equals(1).toArray();
        setPedidosLocales(remainingLocalPedidos);
        setIsSyncingLocal(false);

        if (successCount > 0) {
            toast({ title: "Sincronización Completada", description: `${successCount} pedido(s) se han sincronizado.` });
        }
    
    }, [isOnline, token, findAndReserveNextPedidoId, toast, logout]);

    useEffect(() => {
        loadPedidosLocalesFromDb();
    }, [loadPedidosLocalesFromDb]);
    
    useEffect(() => {
      const checkAndPromptSync = async () => {
          if (isOnline) {
              const count = await db.pedidos.where('isLocal').equals(1).count();
              if (count > 0 && !isSyncingLocal) {
                  syncLocalPedidos();
              }
          }
      }
      const interval = setInterval(checkAndPromptSync, 60000);
      if(!isAuthLoading && user){
        checkAndPromptSync();
      }
      return () => clearInterval(interval);
    }, [isOnline, isSyncingLocal, syncLocalPedidos, isAuthLoading, user]);

    return (
        <DataContext.Provider value={{ 
            asesor, asesores, clientes, productos, empresas, selectedEmpresa, pedidosLocales, 
            setAsesor, setEmpresa, updateEmpresaInState, syncData, addLocalPedido, 
            findAndReserveNextPedidoId,
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

    