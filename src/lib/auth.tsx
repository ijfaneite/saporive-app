"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, Asesor, Token, Cliente, Producto, Empresa, PedidoCreatePayload, DetallePedidoBase } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from '@/hooks/use-toast';

// Helper functions to manage cookies
const setCookie = (name: string, value: string, days: number) => {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    if (typeof document !== 'undefined') {
        document.cookie = name + "=" + (encryptData(value) || "")  + expires + "; path=/";
    }
}

const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') {
        return null;
    }
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
    if (typeof window !== 'undefined') {
        // Use encodeURIComponent to handle non-ASCII characters correctly
        return window.btoa(unescape(encodeURIComponent(data)));
    }
    return data;
};

const decryptData = (encryptedData: string): string => {
    if (typeof window !== 'undefined') {
        try {
            // Use decodeURIComponent to handle non-ASCII characters correctly
            return decodeURIComponent(escape(window.atob(encryptedData)));
        } catch (e) {
            // This will happen if the string is not valid base64,
            // which can be the case for old, unencrypted data.
            return encryptedData;
        }
    }
    return encryptedData;
};

const setEncryptedItem = (key: string, value: any) => {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, encryptData(JSON.stringify(value)));
    }
}

const getEncryptedItem = <T>(key: string): T | null => {
    if (typeof localStorage === 'undefined') {
        return null;
    }
    const storedValue = localStorage.getItem(key);
    if (!storedValue) {
        return null;
    }
    try {
        // decryptData will handle both encrypted and unencrypted data for backwards compatibility
        return JSON.parse(decryptData(storedValue)) as T;
    } catch (error) {
        console.error(`Failed to parse item '${key}' from localStorage`, error);
        // If parsing fails, the data is corrupt, remove it.
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
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setAsesor: (asesor: Asesor) => void;
  setEmpresa: (empresa: Empresa) => void;
  updateEmpresaInState: (empresa: Empresa) => void;
  syncData: (tokenOverride?: string) => Promise<void>;
  isLoading: boolean;
  isSyncing: boolean;
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
  const router = useRouter();
  const { toast } = useToast();

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    
    setAsesores([]);
    setClients([]);
    setProducts([]);
    setEmpresas([]);

    eraseCookie('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('asesores');
    localStorage.removeItem('clients');
    localStorage.removeItem('products');
    localStorage.removeItem('empresas');

    router.push('/login');
  }, [router]);

  const fetchClientsForAsesor = useCallback(async (asesorId: string, tokenOverride?: string) => {
    const currentToken = tokenOverride || token;
    if (!currentToken) return;

    setIsSyncing(true); // Use the general syncing flag
    try {
        const url = new URL(`${API_BASE_URL}${API_ROUTES.clientes}`);
        url.searchParams.append('id_asesor', asesorId);

        const response = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${currentToken}` }
        });

        if (response.status === 401) {
            toast({ variant: "destructive", title: "Sesión expirada", description: "Su sesión ha expirado. Por favor, inicie sesión de nuevo." });
            logout();
            return;
        }
        if (!response.ok) throw new Error('No se pudieron cargar los clientes para el asesor.');

        const clientesData: Cliente[] = await response.json();
        setClients(clientesData);
        setEncryptedItem('clients', clientesData);

    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error al Cargar Clientes",
            description: error instanceof Error ? error.message : "No se pudieron cargar los clientes.",
        });
        setClients([]);
        localStorage.removeItem('clients');
    } finally {
        setIsSyncing(false);
    }
  }, [token, toast, logout]);


  const setAsesor = (asesor: Asesor) => {
    setAsesorState(asesor);
    setEncryptedItem('asesor', asesor);
    // When an advisor is set, fetch their specific clients.
    fetchClientsForAsesor(asesor.idAsesor);
  };

  useEffect(() => {
    try {
      const storedToken = getCookie('auth_token');
      if (storedToken) {
        setToken(storedToken);
        const storedUser = getEncryptedItem<User>('user');
        if (storedUser) setUser(storedUser);
        
        const storedAsesores = getEncryptedItem<Asesor[]>('asesores');
        if (storedAsesores) {
            setAsesores(storedAsesores);
            const storedAsesor = getEncryptedItem<Asesor>('asesor');
            if (storedAsesor) {
                const found = storedAsesores.find(a => a.idAsesor === storedAsesor.idAsesor);
                if (found) {
                    setAsesorState(found);
                    // If we have a stored advisor, we should have their clients stored too.
                    const storedClients = getEncryptedItem<Cliente[]>('clients');
                    if (storedClients) {
                        setClients(storedClients);
                    } else {
                        // Fetch if not present, maybe due to a previous session or error
                        fetchClientsForAsesor(found.idAsesor, storedToken);
                    }
                }
            }
        }
        
        const storedProducts = getEncryptedItem<Producto[]>('products');
        if (storedProducts) setProducts(storedProducts);

        const storedEmpresas = getEncryptedItem<Empresa[]>('empresas');
        if (storedEmpresas) {
            setEmpresas(storedEmpresas);
            const storedEmpresa = getEncryptedItem<Empresa>('empresa');
            if (storedEmpresa) {
                const found = storedEmpresas.find(e => e.idEmpresa === storedEmpresa.idEmpresa);
                if (found) {
                     setSelectedEmpresaState(found);
                } else {
                    localStorage.removeItem('empresa');
                }
            }
        }
      }
    } catch (error) {
      console.error("Failed to load auth state from storage", error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchClientsForAsesor]);

  const syncData = useCallback(async (tokenOverride?: string) => {
    const currentToken = tokenOverride || token;
    if (!currentToken) {
        toast({
            variant: "destructive",
            title: "Error de autenticación",
            description: "No se puede sincronizar sin un token válido.",
          });
        return;
    };
    setIsSyncing(true);
    try {
        const responses = await Promise.all([
            fetch(`${API_BASE_URL}${API_ROUTES.productos}`, { headers: { Authorization: `Bearer ${currentToken}` } }),
            fetch(`${API_BASE_URL}${API_ROUTES.empresas}`, { headers: { Authorization: `Bearer ${currentToken}` } }),
            fetch(`${API_BASE_URL}${API_ROUTES.asesores}`, { headers: { Authorization: `Bearer ${currentToken}` } }),
        ]);

        for (const response of responses) {
            if (response.status === 401) {
                toast({
                    variant: "destructive",
                    title: "Sesión expirada",
                    description: "Su sesión ha expirado. Por favor, inicie sesión de nuevo.",
                });
                logout();
                return;
            }
        }
        
        const [productosRes, empresasRes, asesoresRes] = responses;

        if (!productosRes.ok) throw new Error('No se pudo cargar la lista de precios');
        const productosData: Producto[] = await productosRes.json();
        setProducts(productosData);
        setEncryptedItem('products', productosData);

        if (!empresasRes.ok) throw new Error('No se pudieron cargar las empresas');
        const empresasData: Empresa[] = await empresasRes.json();
        setEmpresas(empresasData);
        setEncryptedItem('empresas', empresasData);
        
        const localEmpresa = getEncryptedItem<Empresa>('empresa');
        if(localEmpresa) {
          const freshEmpresa = empresasData.find(e => e.idEmpresa === localEmpresa.idEmpresa);
          if (freshEmpresa) {
            setSelectedEmpresaState(freshEmpresa);
            setEncryptedItem('empresa', freshEmpresa);
          }
        }

        if (!asesoresRes.ok) throw new Error('No se pudieron cargar los asesores');
        const asesoresData: Asesor[] = await asesoresRes.json();
        setAsesores(asesoresData);
        setEncryptedItem('asesores', asesoresData);

        const localAsesor = getEncryptedItem<Asesor>('asesor');
        if(localAsesor) {
          const freshAsesor = asesoresData.find(a => a.idAsesor === localAsesor.idAsesor);
          if (freshAsesor) {
            setAsesorState(freshAsesor);
            setEncryptedItem('asesor', freshAsesor);
            // Sync clients for the current advisor as well
            await fetchClientsForAsesor(freshAsesor.idAsesor, currentToken);
          }
        } else {
            // If no advisor is set locally, clear local clients to avoid showing stale data.
            setClients([]);
            localStorage.removeItem('clients');
        }

    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error de Sincronización",
            description: error instanceof Error ? error.message : "No se pudieron cargar los datos.",
          });
    } finally {
        setIsSyncing(false);
    }
  }, [token, toast, logout, fetchClientsForAsesor]);

  const login = async (username: string, password: string) => {
    let response;
    try {
        response = await fetch(`${API_BASE_URL}${API_ROUTES.token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            body: new URLSearchParams({
                grant_type: 'password',
                username: username,
                password: password,
                scope: '',
                client_id: '',
                client_secret: ''
            })
        });
    } catch (error) {
        throw new Error("Login - No se pudo conectar al servidor de autenticación.");
    }
    
    if (response.status === 401 || !response.ok) {
        const errorBody = await response.json().catch(() => ({ detail: 'Usuario o clave incorrectos.' }));
        throw new Error(errorBody.detail || 'Usuario o clave incorrectos.');
    }

    const { access_token } = await response.json();
    setToken(access_token);
    setCookie('auth_token', access_token, 7);
    
    let userResponse;
    try {
        userResponse = await fetch(`${API_BASE_URL}${API_ROUTES.me}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' }
        });
    } catch (error) {
        console.error("Error fetching user:", error);
        logout();
        throw new Error("Token - No se pudo conectar con el servidor para obtener los datos del usuario.");
    }

    if (userResponse.status === 401) {
        logout();
        throw new Error("Token de autenticación inválido.");
    }
    
    if (!userResponse.ok) {
        let errorMessage = 'No se pudieron obtener los datos del usuario desde el servidor.';
        try {
            const errorBody = await userResponse.json();
            if (errorBody.detail) {
                errorMessage = errorBody.detail;
            }
        } catch (e) {
            // El cuerpo no era JSON o algo más salió mal.
        }
        throw new Error(errorMessage);
    }

    const userData: User = await userResponse.json();
    setUser(userData);
    setEncryptedItem('user', userData);

    await syncData(access_token);

    const storedAsesor = getEncryptedItem<Asesor>('asesor');
    if (storedAsesor) {
        setAsesorState(storedAsesor);
    }

    const storedEmpresa = getEncryptedItem<Empresa>('empresa');
    if (storedEmpresa) {
      setSelectedEmpresaState(storedEmpresa);
    }
    router.push('/pedidos');
  };
  
  const setEmpresa = (empresa: Empresa) => {
    setSelectedEmpresaState(empresa);
    setEncryptedItem('empresa', empresa);
  };

  const updateEmpresaInState = (updatedEmpresa: Empresa) => {
    const updatedEmpresas = empresas.map(e => e.idEmpresa === updatedEmpresa.idEmpresa ? updatedEmpresa : e);
    setEmpresas(updatedEmpresas);
    setEncryptedItem('empresas', updatedEmpresas);
    
    if (selectedEmpresa?.idEmpresa === updatedEmpresa.idEmpresa) {
        setEmpresa(updatedEmpresa);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, asesor, asesores, clients, products, empresas, selectedEmpresa, login, logout, setAsesor, setEmpresa, updateEmpresaInState, syncData, isLoading, isSyncing }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
