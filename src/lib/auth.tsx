"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from './db';
import { User, Asesor, Token, Cliente, Producto, Empresa, Pedido, PedidoCreatePayload, DetallePedido } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from '@/hooks/use-toast';
import { useApiStatus } from '@/hooks/use-api-status';

// Helper functions to manage cookies
const setCookie = (name: string, value: string, days: number) => {
    if (typeof document === 'undefined') return;
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (encryptData(value) || "")  + expires + "; path=/";
}

const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i=0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) {
            const encryptedValue = c.substring(nameEQ.length,c.length);
            if (!encryptedValue) return null;
            return decryptData(encryptedValue);
        }
    }
    return null;
}

const eraseCookie = (name: string) => {   
    if (typeof document !== 'undefined') {
        document.cookie = name+'=; Max-Age=-99999999; path=/;';  
    }
}

// --- ENCRYPTION HELPERS ---
const encryptData = (data: string): string => {
    if (typeof window === 'undefined') return data;
    return window.btoa(unescape(encodeURIComponent(data)));
};

const decryptData = (encryptedData: string): string => {
    if (typeof window === 'undefined') return encryptedData;
    try {
        return decodeURIComponent(escape(window.atob(encryptedData)));
    } catch (e) {
        return encryptedData;
    }
};

const setEncryptedItem = (key: string, value: any) => {
    if (typeof localStorage !== 'undefined') {
        try {
            localStorage.setItem(key, encryptData(JSON.stringify(value)));
        } catch(e) {
            console.error(`Error saving to localStorage: ${key}`, e)
        }
    }
}

const getEncryptedItem = <T>(key: string): T | null => {
    if (typeof localStorage === 'undefined') return null;
    const storedValue = localStorage.getItem(key);
    if (!storedValue) return null;
    try {
        return JSON.parse(decryptData(storedValue)) as T;
    } catch (error) {
        console.error(`Failed to parse item '${key}' from localStorage`, error);
        localStorage.removeItem(key);
        return null;
    }
}


interface AuthContextType {
  user: User | null;
  token: string | null;
  asesor: Asesor | null;
  asesores: Asesor[];
  clients: Cliente[];
  products: Producto[];
  empresas: Empresa[];
  selectedEmpresa: Empresa | null;
  localPedidos: Pedido[];
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setAsesor: (asesor: Asesor) => void;
  setEmpresa: (empresa: Empresa) => void;
  updateEmpresaInState: (empresa: Empresa) => void;
  findAndReserveNextPedidoId: () => Promise<string | null>;
  syncData: (tokenOverride?: string) => Promise<void>;
  addLocalPedido: (pedidoPayload: Omit<PedidoCreatePayload, 'idPedido' | 'fechaPedido' | 'Status'>) => Promise<void>;
  isLoading: boolean;
  isSyncing: boolean;
  isSyncingLocal: boolean;
  pedidos: Pedido[];
  setPedidos: React.Dispatch<React.SetStateAction<Pedido[]>>;
  fetchPedidos: (pageNum: number, options?: { refresh?: boolean }) => Promise<void>;
  hasMorePedidos: boolean;
  isLoadingPedidos: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [asesor, setAsesorState] = useState<Asesor | null>(null);
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [products, setProducts] = useState<Producto[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresa, setSelectedEmpresaState] = useState<Empresa | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [localPedidos, setLocalPedidos] = useState<Pedido[]>([]);
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  
  // State for Pedidos list
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pedidosPage, setPedidosPage] = useState(1);
  const [hasMorePedidos, setHasMorePedidos] = useState(true);
  const [isLoadingPedidos, setIsLoadingPedidos] = useState(true);


  const isOnline = useApiStatus();
  const router = useRouter();
  const { toast } = useToast();

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    const cachedToken = getCookie('auth_token');
    
    if (cachedToken) {
        setToken(cachedToken);
        const cachedUser = getEncryptedItem<User>('user');
        if (cachedUser) {
            setUser(cachedUser);
            // Load other data only if user is successfully loaded
            setAsesorState(getEncryptedItem<Asesor>('asesor'));
            setSelectedEmpresaState(getEncryptedItem<Empresa>('empresa'));
            setProducts(getEncryptedItem<Producto[]>('products') || []);
            setEmpresas(getEncryptedItem<Empresa[]>('empresas') || []);
            setAsesores(getEncryptedItem<Asesor[]>('asesores') || []);
            setClients(getEncryptedItem<Cliente[]>('clients') || []);
        } else {
            // If user is not in cache, but token is, something is wrong.
            // Let's try to fetch user data. If it fails, logout.
            try {
                const userResponse = await fetch(`${API_BASE_URL}${API_ROUTES.me}`, { headers: { 'Authorization': `Bearer ${cachedToken}`, 'Accept': 'application/json' }});
                if (!userResponse.ok) throw new Error('Invalid session');
                const userData: User = await userResponse.json();
                setEncryptedItem('user', userData);
                setUser(userData);
            } catch {
                eraseCookie('auth_token');
                setToken(null);
                setUser(null);
                router.push('/login');
            }
        }
    }
    setIsLoading(false);
  }, [router]);
  
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);


  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setAsesorState(null);
    setSelectedEmpresaState(null);
    eraseCookie('auth_token');
    // Clear all local storage
    localStorage.removeItem('user');
    localStorage.removeItem('asesor');
    localStorage.removeItem('empresa');
    localStorage.removeItem('products');
    localStorage.removeItem('empresas');
    localStorage.removeItem('asesores');
    localStorage.removeItem('clients');
    router.push('/login');
  }, [router]);
  
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
          setEncryptedItem('clients', clientesData);
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
  
    const updateEmpresaInState = (updatedEmpresa: Empresa) => {
        const updatedEmpresas = empresas.map(e => e.idEmpresa === updatedEmpresa.idEmpresa ? updatedEmpresa : e);
        setEmpresas(updatedEmpresas);
        setEncryptedItem('empresas', updatedEmpresas);
        if (selectedEmpresa?.idEmpresa === updatedEmpresa.idEmpresa) {
            setEmpresa(updatedEmpresa);
        }
    };
    
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
      setProducts(productosData); setEncryptedItem('products', productosData);
      const empresasData: Empresa[] = await empresasRes.json();
      setEmpresas(empresasData); setEncryptedItem('empresas', empresasData);
      const asesoresData: Asesor[] = await asesoresRes.json();
      setAsesores(asesoresData); setEncryptedItem('asesores', asesoresData);
      
      const localAsesor = getEncryptedItem<Asesor>('asesor');
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


  const addLocalPedido = useCallback(async (
    pedidoPayload: Omit<PedidoCreatePayload, 'idPedido' | 'fechaPedido' | 'Status'>
  ) => {
    const lastLocalPedido = await db.localPedidos.orderBy('idPedido').last();
    let nextIdNum = 1;
    if (lastLocalPedido) {
        try {
            const lastIdNum = parseInt(lastLocalPedido.idPedido.split('-')[1]);
            if (!isNaN(lastIdNum)) {
                nextIdNum = lastIdNum + 1;
            }
        } catch (e) {
            // Failsafe, ignore parsing error
        }
    }

    const tempId = `99999999-${String(nextIdNum).padStart(3, '0')}`;
    const now = new Date();

    const detallesConTotal: DetallePedido[] = pedidoPayload.detalles.map((d, index) => ({
        ...d,
        id: `local-${now.getTime()}-${index}`,
        idPedido: tempId,
        Total: d.Cantidad * d.Precio,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        createdBy: user?.username || 'local',
        updatedBy: user?.username || 'local',
    }));

    const newLocalPedido: Pedido = {
      ...pedidoPayload,
      idPedido: tempId,
      fechaPedido: now.toISOString(),
      Status: 'Pendiente (Local)',
      detalles: detallesConTotal,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      createdBy: user?.username || 'local',
      updatedBy: user?.username || 'local',
      isLocal: true,
    };
    
    await db.localPedidos.add(newLocalPedido);
    const allLocalPedidos = await db.localPedidos.orderBy('createdAt').reverse().toArray();
    setLocalPedidos(allLocalPedidos);

    toast({
        title: "Pedido Guardado Localmente",
        description: `El pedido ${tempId} se guardó y se sincronizará cuando haya conexión.`,
    });

  }, [user, toast]);

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
                    // ID already exists, try the next one.
                    nextIdPedidoToTry++;
                    continue; // Continue to next iteration of the while loop.
                }

                if (checkResponse.status === 404) {
                    // ID is available. Let's try to reserve it by updating the company counter.
                    const newCounterValue = nextIdPedidoToTry + 1;
                    
                    const updateResponse = await fetch(`${API_BASE_URL}${API_ROUTES.updateEmpresaPedido}${selectedEmpresa.idEmpresa}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ idPedido: newCounterValue }),
                    });

                    if (updateResponse.ok) {
                        // Success! We've reserved the ID.
                        const updatedEmpresa = await updateResponse.json();
                        updateEmpresaInState(updatedEmpresa);
                        return candidateId; // Return the successfully reserved ID string and exit.
                    } else {
                        // Reservation failed, probably a race condition.
                        // Another client might have updated the counter.
                        // We'll just try the next ID in the sequence.
                        nextIdPedidoToTry++;
                        continue;
                    }
                }
                
                // If we are here, it means checkResponse was not OK and not 404.
                // Some other network or server error.
                toast({ variant: 'destructive', title: 'Error de Red', description: 'No se pudo verificar el ID del pedido.' });
                return null;

            } catch (error) {
                toast({ variant: "destructive", title: "Error de Conexión", description: "No se pudo comunicar con el servidor para obtener un ID de pedido." });
                return null;
            }
        }

        // If we exit the loop, it means we failed after 20 attempts.
        toast({ variant: "destructive", title: "No se pudo asignar ID", description: "No se pudo encontrar un ID de pedido disponible después de varios intentos." });
        return null;
    }, [token, selectedEmpresa, updateEmpresaInState, toast]);

    const loadLocalPedidosFromDb = useCallback(async () => {
        const localPedidosFromDb = await db.localPedidos.orderBy('createdAt').reverse().toArray();
        setLocalPedidos(localPedidosFromDb);
      }, []);

    const fetchPedidos = useCallback(async (pageNum: number, options?: { refresh?: boolean }) => {
        if (!token || !asesor) {
          return;
        }
        const PAGE_SIZE = 25;
    
        const isInitialLoadOrRefresh = pageNum === 1;
        if (isInitialLoadOrRefresh) {
          setIsLoadingPedidos(true);
          setPedidos([]);
        } else {
          // This is for infinite scroll, which we aren't using for now
        }
    
        try {
          const offset = (pageNum - 1) * PAGE_SIZE;
          const url = new URL(`${API_BASE_URL}${API_ROUTES.pedidos}`);
          url.searchParams.append('id_asesor', asesor.idAsesor);
          url.searchParams.append('offset', String(offset));
          url.searchParams.append('limit', String(PAGE_SIZE));
          
          const pedidosRes = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${token}` },
          });
    
          if (pedidosRes.status === 401) {
            toast({ variant: 'destructive', title: 'Sesión expirada', description: 'Por favor inicie sesión de nuevo.' });
            logout();
            return;
          }
    
          if (!pedidosRes.ok) throw new Error('No se pudieron cargar los pedidos');
          
          const newPedidos: Pedido[] = await pedidosRes.json();
    
          setPedidos(prev => isInitialLoadOrRefresh ? newPedidos : [...prev, ...newPedidos]);
          setHasMorePedidos(newPedidos.length === PAGE_SIZE);
          setPedidosPage(pageNum);
    
        } catch (error) {
          toast({
            variant: "destructive",
            title: "Error de Carga de Pedidos",
            description: error instanceof Error ? error.message : "Ocurrió un error al cargar los datos.",
          });
        } finally {
          setIsLoadingPedidos(false);
        }
      }, [token, asesor, toast, logout]);
    
    const syncLocalPedidos = useCallback(async () => {
        const pedidosToSync = await db.localPedidos.toArray();
        if (pedidosToSync.length === 0 || !isOnline || !token) {
            return;
        }

        const confirmSync = window.confirm(`Tiene ${pedidosToSync.length} pedido(s) locales. ¿Desea sincronizarlos ahora?`);
        if (!confirmSync) return;
    
        setIsSyncingLocal(true);
        toast({ title: 'Iniciando sincronización de pedidos locales...' });
        
        const syncedIds: string[] = [];
        let successCount = 0;
    
        for (const localPedido of pedidosToSync) {
            try {
                const reservedId = await findAndReserveNextPedidoId();
                if (!reservedId) {
                    throw new Error(`No se pudo reservar un ID para el pedido local ${localPedido.idPedido}`);
                }
                
                const pedidoPayload: PedidoCreatePayload = {
                  idPedido: reservedId,
                  idEmpresa: localPedido.idEmpresa,
                  fechaPedido: localPedido.fechaPedido,
                  totalPedido: localPedido.totalPedido,
                  idAsesor: localPedido.idAsesor,
                  idCliente: localPedido.idCliente,
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
                    // IMPORTANT: If pedido creation fails, we have already incremented the counter.
                    // This will cause a skipped number, which is better than a duplicate.
                    // The error will be logged, and the local order will remain to be retried later.
                    console.error(`Error al sincronizar pedido ${localPedido.idPedido}: ${errorData.detail || 'Error desconocido'}`);
                    throw new Error(`Error al sincronizar pedido ${localPedido.idPedido}: ${errorData.detail || 'Error desconocido'}`);
                }
                
                syncedIds.push(localPedido.idPedido);
                successCount++;
    
            } catch (error) {
                console.error(`Failed to sync order ${localPedido.idPedido}:`, error);
                 if (error instanceof Error && error.message === "401") {
                    toast({ variant: "destructive", title: "Sesión expirada" });
                    logout();
                    setIsSyncingLocal(false);
                    return; // Stop sync process on auth error
                }
                // Stop on first error to prevent cascade issues
                toast({ variant: "destructive", title: "Error de Sincronización", description: `Fallo al sincronizar pedido ${localPedido.idPedido}. Proceso detenido.` });
                break;
            }
        }

        if (syncedIds.length > 0) {
            await db.localPedidos.bulkDelete(syncedIds);
        }
    
        const remainingLocalPedidos = await db.localPedidos.toArray();
        setLocalPedidos(remainingLocalPedidos);
    
        setIsSyncingLocal(false);

        if (successCount > 0) {
            toast({
                title: "Sincronización Completada",
                description: `${successCount} pedido(s) local(es) se han sincronizado.`,
            });
            await fetchPedidos(1, { refresh: true }); // Refresh the main pedido list
        }
    
    }, [isOnline, token, findAndReserveNextPedidoId, toast, logout, fetchPedidos]);


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
    checkAndPromptSync(); // Also check on mount
    return () => clearInterval(interval);
  }, [isOnline, isSyncingLocal, syncLocalPedidos]);


  const login = async (username: string, password: string) => {
    // Clear all local data on new login to ensure freshness
    eraseCookie('auth_token');
    localStorage.clear();
    setAsesorState(null);
    setSelectedEmpresaState(null);
    setProducts([]);
    setEmpresas([]);
    setAsesores([]);
    setClients([]);
    setPedidos([]);


    let response;
    try {
        response = await fetch(`${API_BASE_URL}${API_ROUTES.token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            body: new URLSearchParams({ grant_type: 'password', username, password, scope: '', client_id: '', client_secret: '' })
        });
    } catch (error) { throw new Error("Login - No se pudo conectar al servidor de autenticación."); }
    
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ detail: 'Usuario o clave incorrectos.' }));
        throw new Error(errorBody.detail || 'Usuario o clave incorrectos.');
    }
    const { access_token } = await response.json();
    
    let userResponse;
    try {
        userResponse = await fetch(`${API_BASE_URL}${API_ROUTES.me}`, { headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' }});
    } catch (error) { logout(); throw new Error("Token - No se pudo conectar con el servidor."); }
    if (!userResponse.ok) { logout(); throw new Error('No se pudieron obtener los datos del usuario.'); }
    
    const userData: User = await userResponse.json();
    setCookie('auth_token', access_token, 7);
    setEncryptedItem('user', userData);
    setUser(userData);
    setToken(access_token);
    await syncData(access_token);
    router.push('/pedidos');
  };

  const setAsesor = useCallback((asesor: Asesor) => {
    setAsesorState(asesor);
    setEncryptedItem('asesor', asesor);
    if(token) fetchClientsForAsesor(asesor.idAsesor, token);
  }, [token, fetchClientsForAsesor]);

  const setEmpresa = (empresa: Empresa) => {
    setSelectedEmpresaState(empresa);
    setEncryptedItem('empresa', empresa);
  };
  
  useEffect(() => {
    if (user && user.idRol !== 'admin' && asesores.length > 0 && !asesor) {
        const match = asesores.find(a => a.idAsesor.toLowerCase() === user.username.toLowerCase());
        if (match) setAsesor(match);
    }
  }, [user, asesores, asesor, setAsesor]);

  return (
    <AuthContext.Provider value={{ 
        user, token, asesor, asesores, clients, products, empresas, selectedEmpresa, localPedidos, 
        login, logout, setAsesor, setEmpresa, updateEmpresaInState, syncData, addLocalPedido, 
        findAndReserveNextPedidoId, isLoading, isSyncing, isSyncingLocal,
        pedidos, setPedidos, fetchPedidos, hasMorePedidos, isLoadingPedidos
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
