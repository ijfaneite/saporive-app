"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { User, Asesor, Token } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';

interface AuthContextType {
  user: User | null;
  token: string | null;
  asesor: Asesor | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setAsesor: (asesor: Asesor) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function setCookie(name: string, value: string, days: number) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}

function eraseCookie(name: string) {   
  document.cookie = name +'=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [asesor, setAsesorState] = useState<Asesor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    try {
      const storedToken = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
      const storedUser = localStorage.getItem('user');
      const storedAsesor = localStorage.getItem('asesor');

      if (storedToken) {
        setToken(storedToken);
        if (storedUser) setUser(JSON.parse(storedUser));
        if (storedAsesor) setAsesorState(JSON.parse(storedAsesor));
      }
    } catch (error) {
      console.error("Failed to load auth state from storage", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    let response;
    
    try {
      response = await fetch(`${API_BASE_URL}${API_ROUTES.token}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: '',
          username,
          password,
          scope: '',
          client_id: '',
          client_secret: ''
        }),
      });
    } catch (error) {
        console.error("Error fetching token:", error);
        throw new Error("No se pudo conectar al servidor de autenticación.");
    }
    
    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Login failed response:", errorBody);
        throw new Error('Usuario o clave incorrectos. Status: ' + response.status);
    }

    const { access_token }: Token = await response.json();
    
    // Give the server a moment to process the token
    await new Promise(resolve => setTimeout(resolve, 500));

    setToken(access_token);
    setCookie('auth_token', access_token, 7);

    let userResponse;
    try {
        userResponse = await fetch(`${API_BASE_URL}${API_ROUTES.me}`, {
          headers: { Authorization: `Bearer ${access_token}` },
        });
    } catch (error) {
        console.error("Error fetching user:", error);
        throw new Error("No se pudo conectar con el servidor para obtener los datos del usuario.");
    }

    if (!userResponse.ok) {
        const errorBody = await userResponse.text();
        console.error("Fetch user failed:", errorBody)
        throw new Error('No se pudieron obtener los datos del usuario desde el servidor.');
    }

    const userData: User = await userResponse.json();
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    router.push('/pedidos');
    router.refresh();
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setAsesorState(null);
    eraseCookie('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('asesor');
    router.push('/login');
  };

  const setAsesor = (asesor: Asesor) => {
    setAsesorState(asesor);
    localStorage.setItem('asesor', JSON.stringify(asesor));
  };

  return (
    <AuthContext.Provider value={{ user, token, asesor, login, logout, setAsesor, isLoading }}>
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
