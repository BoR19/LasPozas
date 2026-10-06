import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db, type Staff, encodePassword } from '../database/db';

interface AuthContextType {
  user: Staff | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
  isLector: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('aqua_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('aqua_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    const staff = await db.staff
      .where('username')
      .equals(username)
      .first();

    if (staff && staff.password === encodePassword(password)) {
      setUser(staff);
      localStorage.setItem('aqua_user', JSON.stringify(staff));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('aqua_user');
  };

  const isAdmin = user?.role === 'admin';
  const isLector = user?.role === 'lector';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isLector }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
