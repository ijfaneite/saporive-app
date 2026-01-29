"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, Token, AppError } from '@/lib/types';
import { API_BASE_URL, API_ROUTES } from '@/lib/config';
import { db } from './db';
import { Result, success, failure, safeFetch } from './result';

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
  login: (username: string, password: string) => Promise<Result<User, AppError>>;
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

  const login = async (username: string, password: string): Promise<Result<User, AppError>> => {
    const tokenResult = await safeFetch<Token>(`${API_BASE_URL}${API_ROUTES.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        body: new URLSearchParams({ grant_type: 'password', username, password, scope: '', client_id: '', client_secret: '' })
    });
    
    if (!tokenResult.success) {
        return failure(new AppError(tokenResult.error.message || 'Usuario o clave incorrectos.', tokenResult.error.code));
    }

    const { access_token } = tokenResult.value;
    
    const userResult = await safeFetch<User>(`${API_BASE_URL}${API_ROUTES.me}`, { headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' }});

    if (!userResult.success) {
        eraseCookie('auth_token');
        return failure(new AppError('No se pudieron obtener los datos del usuario.', userResult.error.code));
    }
    
    const userData = userResult.value;

    await db.clearAllDataOnLogout();

    setCookie('auth_token', access_token, 7);
    await db.user.put(userData);
    
    setUser(userData);
    setToken(access_token);
    router.push('/');
    return success(userData);
  };

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    eraseCookie('auth_token');
    await db.clearAllDataOnLogout();
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
