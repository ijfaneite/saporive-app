"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, Asesor, Token, Cliente, Producto, Empresa } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from '@/hooks/use-toast';

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
        localStorage.setItem(key, encryptData(JSON.stringify(value)));
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
  const [token, setToken] = useState<string | null>(() => getCookie('auth_token'));
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
    setToken(null);
    setUser(null);
    setAsesorState(null);
    setSelectedEmpresaState(null);
    setAsesores([]);
    setClients([]);
    setProducts([]);
    setEmpresas([]);
    eraseCookie('auth_token');
    if (typeof localStorage !== 'undefined') localStorage.clear();
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
              toast({ variant: "destructive", title: "Error al Cargar Clientes", description: error instanceof Error ? error.message : "Error desconocido." });
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

  useEffect(() => {
    const initialDataLoad = async () => {
      if (!token) { setIsLoading(false); return; }
      setIsLoading(true);
      setUser(getEncryptedItem<User>('user'));
      setAsesorState(getEncryptedItem<Asesor>('asesor'));
      setSelectedEmpresaState(getEncryptedItem<Empresa>('empresa'));
      const cachedProducts = getEncryptedItem<Producto[]>('products');
      if (cachedProducts && cachedProducts.length > 0) {
        setProducts(cachedProducts);
        setEmpresas(getEncryptedItem<Empresa[]>('empresas') || []);
        setAsesores(getEncryptedItem<Asesor[]>('asesores') || []);
        setClients(getEncryptedItem<Cliente[]>('clients') || []);
        setIsLoading(false);
        await syncData(token);
      } else {
        await syncData(token);
        setIsLoading(false);
      }
    };
    initialDataLoad();
  }, [token, syncData]);

  const login = async (username: string, password: string) => {
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
    if (typeof localStorage !== 'undefined') localStorage.clear();
    setCookie('auth_token', access_token, 7);
    setEncryptedItem('user', userData);
    setUser(userData);
    setToken(access_token);
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

  const updateEmpresaInState = (updatedEmpresa: Empresa) => {
    const updatedEmpresas = empresas.map(e => e.idEmpresa === updatedEmpresa.idEmpresa ? updatedEmpresa : e);
    setEmpresas(updatedEmpresas);
    setEncryptedItem('empresas', updatedEmpresas);
    if (selectedEmpresa?.idEmpresa === updatedEmpresa.idEmpresa) setEmpresa(updatedEmpresa);
  };

  return (
    <AuthContext.Provider value={{ user, token, asesor, asesores, clients, products, empresas, selectedEmpresa, login, logout, setAsesor, setEmpresa, updateEmpresaInState, syncData, isLoading, isSyncing }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
