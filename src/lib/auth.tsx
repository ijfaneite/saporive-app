"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, Asesor, Token, Cliente, Producto, Empresa } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { useToast } from '@/hooks/use-toast';

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
  updateEmpresa: (empresa: Empresa) => Promise<void>;
  syncData: (tokenOverride?: string) => Promise<void>;
  isLoading: boolean;
  isSyncing: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function setCookie(name: string, value: string, days: number) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function eraseCookie(name: string) {
  document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

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

  useEffect(() => {
    try {
      const storedToken = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
      const storedUser = sessionStorage.getItem('user');
      const storedAsesor = sessionStorage.getItem('asesor');
      const storedAsesores = sessionStorage.getItem('asesores');
      const storedClients = sessionStorage.getItem('clients');
      const storedProducts = sessionStorage.getItem('products');
      const storedEmpresas = sessionStorage.getItem('empresas');
      const storedEmpresa = sessionStorage.getItem('empresa');

      if (storedToken) {
        setToken(storedToken);
        if (storedUser) setUser(JSON.parse(storedUser));
        if (storedAsesor) setAsesorState(JSON.parse(storedAsesor));
        if (storedAsesores) setAsesores(JSON.parse(storedAsesores));
        if (storedClients) setClients(JSON.parse(storedClients));
        if (storedProducts) setProducts(JSON.parse(storedProducts));
        if (storedEmpresas) {
            const parsedEmpresas = JSON.parse(storedEmpresas) as Empresa[];
            setEmpresas(parsedEmpresas);
            if (storedEmpresa) {
                const parsedSelected = JSON.parse(storedEmpresa) as Empresa;
                const found = parsedEmpresas.find(e => e.idEmpresa === parsedSelected.idEmpresa);
                if (found) {
                     setSelectedEmpresaState(found);
                }
            }
        }
      }
    } catch (error) {
      console.error("Failed to load auth state from storage", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
        const [clientesRes, productosRes, empresasRes, asesoresRes] = await Promise.all([
            fetch(`${API_BASE_URL}${API_ROUTES.clientes}`, { headers: { Authorization: `Bearer ${currentToken}` } }),
            fetch(`${API_BASE_URL}${API_ROUTES.productos}`, { headers: { Authorization: `Bearer ${currentToken}` } }),
            fetch(`${API_BASE_URL}${API_ROUTES.empresas}`, { headers: { Authorization: `Bearer ${currentToken}` } }),
            fetch(`${API_BASE_URL}${API_ROUTES.asesores}`, { headers: { Authorization: `Bearer ${currentToken}` } }),
        ]);

        if (!clientesRes.ok) throw new Error('No se pudieron cargar los clientes');
        const clientesData: Cliente[] = await clientesRes.json();
        setClients(clientesData);
        sessionStorage.setItem('clients', JSON.stringify(clientesData));

        if (!productosRes.ok) throw new Error('No se pudo cargar la lista de precios');
        const productosData: Producto[] = await productosRes.json();
        setProducts(productosData);
        sessionStorage.setItem('products', JSON.stringify(productosData));

        if (!empresasRes.ok) throw new Error('No se pudieron cargar las empresas');
        const empresasData = await empresasRes.json();
        const formattedEmpresas: Empresa[] = empresasData.map((e: any) => ({
            RazonSocial: e.RazonSocial,
            idPedido: e.idPedido,
            idRecibo: e.idRecibo,
            idEmpresa: String(e.idEmpresa),
        }));
        setEmpresas(formattedEmpresas);
        sessionStorage.setItem('empresas', JSON.stringify(formattedEmpresas));

        if (!asesoresRes.ok) throw new Error('No se pudieron cargar los asesores');
        const asesoresData: Asesor[] = await asesoresRes.json();
        setAsesores(asesoresData);
        sessionStorage.setItem('asesores', JSON.stringify(asesoresData));

    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error de Sincronización",
            description: error instanceof Error ? error.message : "No se pudieron cargar los datos.",
          });
    } finally {
        setIsSyncing(false);
    }
}, [token, toast]);

  const login = async (username: string, password: string) => {
    let response;
    try {
        response = await fetch(`${API_BASE_URL}${API_ROUTES.token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            body: new URLSearchParams({
                grant_type: '',
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
    
    if (!response.ok) {
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
        throw new Error("Token - No se pudo conectar con el servidor para obtener los datos del usuario.");
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
    sessionStorage.setItem('user', JSON.stringify(userData));

    await syncData(access_token);

    const storedEmpresa = sessionStorage.getItem('empresa');
    if (storedEmpresa) {
      router.push('/pedidos');
    } else {
      router.push('/configuracion');
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setAsesorState(null);
    setAsesores([]);
    setClients([]);
    setProducts([]);
    setEmpresas([]);
    setSelectedEmpresaState(null);
    eraseCookie('auth_token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('asesor');
    sessionStorage.removeItem('asesores');
    sessionStorage.removeItem('clients');
    sessionStorage.removeItem('products');
    sessionStorage.removeItem('empresas');
    sessionStorage.removeItem('empresa');
    router.push('/login');
  };

  const setAsesor = (asesor: Asesor) => {
    setAsesorState(asesor);
    sessionStorage.setItem('asesor', JSON.stringify(asesor));
  };
  
  const setEmpresa = (empresa: Empresa) => {
    setSelectedEmpresaState(empresa);
    sessionStorage.setItem('empresa', JSON.stringify(empresa));
  };

  const updateEmpresa = async (empresa: Empresa) => {
    console.log(`Simulating update for idPedido for ${empresa.RazonSocial} to ${empresa.idPedido}`);
    const updatedEmpresas = empresas.map(e => e.idEmpresa === empresa.idEmpresa ? empresa : e);
    setEmpresas(updatedEmpresas);
    sessionStorage.setItem('empresas', JSON.stringify(updatedEmpresas));
    if (selectedEmpresa?.idEmpresa === empresa.idEmpresa) {
        setEmpresa(empresa);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, asesor, asesores, clients, products, empresas, selectedEmpresa, login, logout, setAsesor, setEmpresa, updateEmpresa, syncData, isLoading, isSyncing }}>
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
