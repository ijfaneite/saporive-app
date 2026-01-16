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
  clients: Cliente[];
  products: Producto[];
  empresas: Empresa[];
  selectedEmpresa: Empresa | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setAsesor: (asesor: Asesor) => void;
  setEmpresa: (empresa: Empresa) => void;
  updateEmpresa: (empresa: Empresa) => Promise<void>;
  syncData: () => Promise<void>;
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
      const storedUser = localStorage.getItem('user');
      const storedAsesor = localStorage.getItem('asesor');
      const storedClients = localStorage.getItem('clients');
      const storedProducts = localStorage.getItem('products');
      const storedEmpresas = localStorage.getItem('empresas');
      const storedEmpresa = localStorage.getItem('empresa');

      if (storedToken) {
        setToken(storedToken);
        if (storedUser) setUser(JSON.parse(storedUser));
        if (storedAsesor) setAsesorState(JSON.parse(storedAsesor));
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

  const syncData = useCallback(async () => {
    if (!token) {
        toast({
            variant: "destructive",
            title: "Error de autenticación",
            description: "No se puede sincronizar sin un token válido.",
          });
        return;
    };
    setIsSyncing(true);
    try {
        const [clientesRes, productosRes, empresasRes] = await Promise.all([
            fetch(`${API_BASE_URL}${API_ROUTES.clientes}`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_BASE_URL}${API_ROUTES.productos}`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_BASE_URL}${API_ROUTES.empresas}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!clientesRes.ok) throw new Error('No se pudieron cargar los clientes');
        const clientesData: Cliente[] = await clientesRes.json();
        setClients(clientesData);
        localStorage.setItem('clients', JSON.stringify(clientesData));

        if (!productosRes.ok) throw new Error('No se pudo cargar la lista de precios');
        const productosData: Producto[] = await productosRes.json();
        setProducts(productosData);
        localStorage.setItem('products', JSON.stringify(productosData));

        if (!empresasRes.ok) throw new Error('No se pudieron cargar las empresas');
        const empresasData = await empresasRes.json();
        const formattedEmpresas: Empresa[] = empresasData.map((e: any) => ({
            RazonSocial: e.RazonSocial,
            idPedido: e.idPedido,
            idRecibo: e.idRecibo,
            idEmpresa: String(e.idEmpresa),
        }));
        setEmpresas(formattedEmpresas);
        localStorage.setItem('empresas', JSON.stringify(formattedEmpresas));

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
    
    await new Promise(resolve => setTimeout(resolve, 500));

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
        const errorBody = await userResponse.text();
        console.error("Fetch user failed:", errorBody)
        throw new Error('No se pudieron obtener los datos del usuario desde el servidor.');
    }

    const userData: User = await userResponse.json();
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));

    await syncData();

    router.push('/pedidos');
    router.refresh();
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setAsesorState(null);
    setClients([]);
    setProducts([]);
    setEmpresas([]);
    setSelectedEmpresaState(null);
    eraseCookie('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('asesor');
    localStorage.removeItem('clients');
    localStorage.removeItem('products');
    localStorage.removeItem('empresas');
    localStorage.removeItem('empresa');
    router.push('/login');
  };

  const setAsesor = (asesor: Asesor) => {
    setAsesorState(asesor);
    localStorage.setItem('asesor', JSON.stringify(asesor));
  };
  
  const setEmpresa = (empresa: Empresa) => {
    setSelectedEmpresaState(empresa);
    localStorage.setItem('empresa', JSON.stringify(empresa));
  };

  const updateEmpresa = async (empresa: Empresa) => {
    console.log(`Simulating update for idPedido for ${empresa.RazonSocial} to ${empresa.idPedido}`);
    const updatedEmpresas = empresas.map(e => e.idEmpresa === empresa.idEmpresa ? empresa : e);
    setEmpresas(updatedEmpresas);
    localStorage.setItem('empresas', JSON.stringify(updatedEmpresas));
    if (selectedEmpresa?.idEmpresa === empresa.idEmpresa) {
        setEmpresa(empresa);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, asesor, clients, products, empresas, selectedEmpresa, login, logout, setAsesor, setEmpresa, updateEmpresa, syncData, isLoading, isSyncing }}>
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
