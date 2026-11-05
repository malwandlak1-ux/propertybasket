import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  roles: string[];
  initials: string;
}

interface AuthState {
  user: AuthUser | null;
  booting: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  booting: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [booting, setBooting] = useState(true);

  // Restore session on cold start.
  useEffect(() => {
    (async () => {
      try {
        if (await getToken()) {
          const { user } = await api.get<{ user: AuthUser }>('/me');
          setUser(user);
        }
      } catch {
        await setToken(null); // stale/revoked token
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: AuthUser }>('/auth/login', {
      email,
      password,
      device_name: 'property-basket-app',
    });
    await setToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Token already dead server-side — still clear locally.
    }
    await setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, booting, login, logout }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
