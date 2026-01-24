"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { db } from './db';

const setCookie = (name: string, value: string, days: number) => {
    if (typeof document === 'undefined') return;
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

const eraseCookie = (name: string) => {
    if (typeof document !== 'undefined') {
        document.cookie = name + '=; Max-Age=-99999999; path=/;';
    }
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadSession = async () => {
        const storedToken = getCookie('auth_token');
        if (storedToken) {
            const storedUser = await db.user.limit(1).first();
            if (storedUser) {
                setUser(storedUser);
                setToken(storedToken);
            } else {
                eraseCookie('auth_token');
            }
        }
        setIsLoading(false);
    }
    loadSession();
  }, []);

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
    } catch (error) { 
        eraseCookie('auth_token');
        throw new Error("Token - No se pudo conectar con el servidor."); 
    }

    if (!userResponse.ok) { 
        eraseCookie('auth_token');
        throw new Error('No se pudieron obtener los datos del usuario.'); 
    }
    
    const userData: User = await userResponse.json();

    await db.clearAllData();

    setCookie('auth_token', access_token, 7);
    await db.user.put(userData);
    
    setUser(userData);
    setToken(access_token);
    router.push('/pedidos');
  };

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    eraseCookie('auth_token');
    await db.clearAllData();
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
