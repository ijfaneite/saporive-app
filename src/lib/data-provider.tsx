"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Asesor, Cliente, Producto, Empresa, Pedido, PedidoCreatePayload, DetallePedido, AppError } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from '@/hooks/use-toast';
import { useApiStatus } from '@/hooks/use-api-status';
import { useAuth } from './auth';
import { db } from './db';
import { Result, success, failure, safeFetch } from './result';


interface DataContextType {
    asesor: Asesor | null;
    asesores: Asesor[];
    clientes: Cliente[];
    productos: Producto[];
    empresas: Empresa[];
    selectedEmpresa: Empresa | null;
    pedidosLocales: Pedido[];
    findAndReserveNextPedidoId: () => Promise<Result<string, AppError>>;
    setAsesor: (asesor: Asesor) => void;
    setEmpresa: (empresa: Empresa) => void;
    updateEmpresaInState: (empresa: Empresa) => Promise<void>;
    syncData: () => Promise<Result<void, AppError>>;
    addLocalPedido: (pedidoPayload: Omit<PedidoCreatePayload, 'idPedido' | 'fechaPedido' | 'Status'>) => Promise<Result<Pedido, AppError>>;
    syncLocalPedidos: () => Promise<Result<number, AppError>>;
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

    const fetchClientesForAsesor = useCallback(async (asesorId: string): Promise<Result<Cliente[], AppError>> => {
        if (!token) return failure(new AppError('No autenticado', 401));
        if (!isOnline) {
            const cachedClientes = await db.clientes.toArray();
            return success(cachedClientes);
        }
        
        const url = new URL(`${API_BASE_URL}${API_ROUTES.clientes}`);
        url.searchParams.append('id_asesor', asesorId);
        
        const result = await safeFetch<Cliente[]>(url.toString(), { headers: { Authorization: `Bearer ${token}` } });

        if (result.success) {
            await db.clientes.bulkPut(result.value);
            setClientes(result.value);
        }
        
        return result;
    }, [token, isOnline]);
    
    const syncData = useCallback(async (): Promise<Result<void, AppError>> => {
        if (!token || !isOnline) return success(undefined);
        
        setIsSyncing(true);
        try {
          const endpoints = [
            `${API_BASE_URL}${API_ROUTES.productos}`,
            `${API_BASE_URL}${API_ROUTES.empresas}`,
            `${API_BASE_URL}${API_ROUTES.asesores}`,
          ];

          const results = await Promise.all(
              endpoints.map(url => safeFetch(url, { headers: { Authorization: `Bearer ${token}` } }))
          );

          const productosResult = results[0] as Result<Producto[], AppError>;
          const empresasResult = results[1] as Result<Empresa[], AppError>;
          const asesoresResult = results[2] as Result<Asesor[], AppError>;

          if (!productosResult.success) return failure(productosResult.error);
          if (!empresasResult.success) return failure(empresasResult.error);
          if (!asesoresResult.success) return failure(asesoresResult.error);

          await db.productos.bulkPut(productosResult.value);
          setProductos(productosResult.value);
          
          const incomingEmpresas = empresasResult.value;
          const localEmpresas = await db.empresas.toArray();
          const localEmpresasMap = new Map(localEmpresas.map(e => [e.idEmpresa, e]));

          const mergedEmpresas = incomingEmpresas.map(incoming => {
            const local = localEmpresasMap.get(incoming.idEmpresa);
            if (local) {
              // Merge: take server data, but keep higher counter values from local cache
              return {
                ...incoming,
                idPedido: Math.max(local.idPedido, incoming.idPedido),
                idRecibo: Math.max(local.idRecibo, incoming.idRecibo),
              };
            }
            return incoming; // No local version, use server's
          });

          await db.empresas.bulkPut(mergedEmpresas);
          setEmpresas(mergedEmpresas);

          await db.asesores.bulkPut(asesoresResult.value);
          setAsesores(asesoresResult.value);
          
          const configAsesor = await db.config.get('asesor');
          const localAsesor = configAsesor?.value as Asesor | null;

          if(localAsesor) {
            const freshAsesor = asesoresResult.value.find(a => a.idAsesor === localAsesor.idAsesor);
            if (freshAsesor) {
                const clientesResult = await fetchClientesForAsesor(freshAsesor.idAsesor);
                if (!clientesResult.success) return failure(clientesResult.error);
            }
          }
          return success(undefined);
        } catch (error) {
            return failure(new AppError("Error inesperado durante la sincronización.", "SYNC_ERROR", error));
        } finally {
          setIsSyncing(false);
        }
      }, [token, isOnline, fetchClientesForAsesor]);

    const setAsesor = useCallback(async (asesorToSet: Asesor) => {
        setAsesorState(asesorToSet);
        await db.config.put({ key: 'asesor', value: asesorToSet });
        
        const result = await fetchClientesForAsesor(asesorToSet.idAsesor);

        if (!result.success) {
            if (result.error.code === 401) {
                toast({ variant: "destructive", title: "Sesión expirada" });
                logout();
            } else if (isOnline) {
                toast({ variant: "destructive", title: "Error al Cargar Clientes", description: result.error.message });
            }
        }
    }, [fetchClientesForAsesor, isOnline, toast, logout]);

    useEffect(() => {
        const loadAppData = async () => {
            if (isAuthLoading || !user) {
                if(!isAuthLoading) setIsDataLoading(false);
                return;
            }

            setIsDataLoading(true);

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

            setAsesorState(localAsesor);
            setSelectedEmpresaState(localEmpresa);
            setProductos(cachedProductos);
            setEmpresas(cachedEmpresas);
            setAsesores(cachedAsesores);
            setClientes(cachedClientes);
            
            if (isOnline) {
                const needsMasterSync = cachedProductos.length === 0 || cachedEmpresas.length === 0 || cachedAsesores.length === 0;
                if (needsMasterSync) {
                    const syncResult = await syncData();
                     if (!syncResult.success) {
                        if (syncResult.error.code === 401) {
                            toast({ variant: "destructive", title: "Sesión expirada" });
                            logout();
                        } else {
                            toast({ variant: "destructive", title: "Error de Sincronización", description: syncResult.error.message });
                        }
                    }
                } else if (localAsesor && cachedClientes.length === 0) {
                    await fetchClientesForAsesor(localAsesor.idAsesor);
                }
            }
            
            setIsDataLoading(false);
        };
        
        loadAppData();
    }, [user, isAuthLoading, isOnline, syncData, fetchClientesForAsesor, logout, toast]);

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
    
    const findAndReserveNextPedidoId = useCallback(async (): Promise<Result<string, AppError>> => {
        if (!token || !selectedEmpresa || !isOnline) {
            return failure(new AppError('No conectado o sin configuración para reservar ID.', 'PRECONDITION_FAILED'));
        }
    
        let nextIdCounter = selectedEmpresa.idPedido;
        const MAX_ATTEMPTS = 50;
    
        for (let attempts = 0; attempts < MAX_ATTEMPTS; attempts++) {
            nextIdCounter++;
            
            const date = new Date();
            const year = String(date.getFullYear()).slice(-2);
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const nextIdStr = String(nextIdCounter).padStart(3, '0');
            const candidateId = `${year}${month}${day}-${nextIdStr}`;
    
            const checkResult = await safeFetch(`${API_BASE_URL}${API_ROUTES.pedidos}${candidateId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
    
            if (checkResult.success) { // ID exists, try next one
                continue;
            }

            if (checkResult.error.code === 404) { // ID is available
                const updateResult = await safeFetch(`${API_BASE_URL}${API_ROUTES.updateEmpresaPedido}${selectedEmpresa.idEmpresa}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ idPedido: nextIdCounter }),
                });

                if (updateResult.success) {
                    const updatedEmpresa = { ...selectedEmpresa, idPedido: nextIdCounter };
                    await updateEmpresaInState(updatedEmpresa);
                    return success(candidateId);
                } else {
                    // Failed to reserve, maybe a race condition. Loop will continue.
                    toast({ variant: 'destructive', title: 'Error de Concurrencia', description: 'No se pudo reservar el ID. Reintentando...' });
                    continue; 
                }
            } else { // Another error occurred during check
                return failure(new AppError(`Error al verificar el ID del pedido: ${checkResult.error.message}`, checkResult.error.code));
            }
        }
    
        return failure(new AppError("No se pudo encontrar un ID de pedido disponible después de varios intentos.", "ID_RESERVATION_FAILED"));
    }, [token, selectedEmpresa, updateEmpresaInState, toast, isOnline]);

    const addLocalPedido = useCallback(async (
        pedidoPayload: Omit<PedidoCreatePayload, 'idPedido' | 'fechaPedido' | 'Status'>
    ): Promise<Result<Pedido, AppError>> => {
        if (!user) return failure(new AppError('Usuario no encontrado para pedido local.', 'NO_USER'));
        try {
            const allLocalPedidos = await db.pedidos.where('isLocal').equals(1).toArray();
            const lastIdNum = allLocalPedidos.reduce((max, p) => {
                try {
                    const num = parseInt(p.idPedido.split('-')[1]);
                    return num > max ? num : max;
                } catch { return max; }
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
            return success(newLocalPedido);
        } catch(error) {
            return failure(new AppError("Error al guardar pedido local en la base de datos.", "DB_ERROR", error));
        }

    }, [user, toast]);

    const loadPedidosLocalesFromDb = useCallback(async () => {
        const localPedidosFromDb = await db.pedidos.where('isLocal').equals(1).reverse().sortBy('createdAt');
        setPedidosLocales(localPedidosFromDb);
    }, []);
    
    const syncLocalPedidos = useCallback(async (): Promise<Result<number, AppError>> => {
        if (!isOnline || !token) {
            return failure(new AppError("No se pueden sincronizar los pedidos locales sin conexión.", 'OFFLINE'));
        }
        const pedidosToSync = await db.pedidos.where('isLocal').equals(1).toArray();
        if (pedidosToSync.length === 0) return success(0);
    
        setIsSyncingLocal(true);
        toast({ title: 'Iniciando sincronización de pedidos locales...' });
        
        let successCount = 0;
    
        for (const localPedido of pedidosToSync) {
            const reservedIdResult = await findAndReserveNextPedidoId();
            if (!reservedIdResult.success) {
                setIsSyncingLocal(false);
                return failure(new AppError(`No se pudo reservar un ID para el pedido ${localPedido.idPedido}. Proceso detenido.`, 'ID_RESERVATION_FAILED', reservedIdResult.error));
            }
            
            const pedidoPayload: PedidoCreatePayload = {
              idPedido: reservedIdResult.value, idEmpresa: localPedido.idEmpresa, fechaPedido: localPedido.fechaPedido,
              totalPedido: localPedido.totalPedido, idAsesor: localPedido.idAsesor, idCliente: localPedido.idCliente,
              Status: "Pendiente",
              detalles: localPedido.detalles.map(d => ({ Cantidad: d.Cantidad, Precio: d.Precio, idProducto: d.idProducto })),
            };

            const syncResult = await safeFetch(`${API_BASE_URL}${API_ROUTES.pedidos}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(pedidoPayload),
            });

            if (syncResult.success) {
                await db.pedidos.delete(localPedido.idPedido);
                successCount++;
            } else {
                setIsSyncingLocal(false);
                return failure(new AppError(`Error al sincronizar pedido ${localPedido.idPedido}: ${syncResult.error.message}`, 'SYNC_FAILED', syncResult.error));
            }
        }
    
        await loadPedidosLocalesFromDb();
        setIsSyncingLocal(false);
        return success(successCount);
    
    }, [isOnline, token, findAndReserveNextPedidoId, toast, loadPedidosLocalesFromDb]);

    useEffect(() => {
        loadPedidosLocalesFromDb();
    }, [loadPedidosLocalesFromDb]);

    return (
        <DataContext.Provider value={{ 
            asesor, asesores, clientes, productos, empresas, selectedEmpresa, pedidosLocales, 
            setAsesor, setEmpresa, updateEmpresaInState, syncData, addLocalPedido, 
            findAndReserveNextPedidoId, syncLocalPedidos,
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
