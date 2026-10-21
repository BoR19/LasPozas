import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db, type Staff, encodePassword, decodePassword } from '../database/db';
import { db as firestoreDb } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

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

  const verifyPassword = (enteredPassword: string, storedPassword: string): boolean => {
    if (!storedPassword) return false;
    const raw = enteredPassword;
    const trimmed = enteredPassword.trim();

    // 1. Direct plain text match
    if (storedPassword === raw || storedPassword === trimmed) return true;

    // 2. Encoded match via encodePassword
    if (storedPassword === encodePassword(raw) || storedPassword === encodePassword(trimmed)) return true;

    // 3. Raw standard btoa match
    try {
      if (storedPassword === btoa(raw) || storedPassword === btoa(trimmed)) return true;
    } catch {}

    // 4. Decoded stored match
    try {
      const dec = decodePassword(storedPassword);
      if (dec === raw || dec === trimmed) return true;
    } catch {}

    try {
      const decBtoa = atob(storedPassword);
      if (decBtoa === raw || decBtoa === trimmed) return true;
    } catch {}

    return false;
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    const rawInput = (username || '').trim();
    if (!rawInput) return false;

    const normalizedInput = rawInput.startsWith('@') ? rawInput.slice(1).toLowerCase() : rawInput.toLowerCase();

    // Helper to test if a staff record matches the input username
    const matchesUsername = (s: Staff) => {
      const cleanStored = (s.username || '').trim();
      const normStored = cleanStored.startsWith('@') ? cleanStored.slice(1).toLowerCase() : cleanStored.toLowerCase();
      return cleanStored.toLowerCase() === rawInput.toLowerCase() ||
             normStored === normalizedInput ||
             cleanStored.toLowerCase() === `@${normalizedInput}` ||
             `@${normStored}` === normalizedInput;
    };

    // 1. Check local Dexie first
    const allLocalStaff = await db.staff.toArray();
    let staff = allLocalStaff.find(matchesUsername);

    // 2. If not found locally and device is online, check Firestore 'staff' collection
    // (Crucial for cross-device usage: when reader is added on PC and logged in on mobile/tablet)
    if (!staff && navigator.onLine) {
      try {
        const staffCol = collection(firestoreDb, 'staff');
        const snap = await getDocs(staffCol);
        for (const docSnap of snap.docs) {
          const remoteData = docSnap.data() as Staff & { deleted?: boolean };
          if (remoteData && !remoteData.deleted) {
            // Cache to local Dexie
            const existingLocal = await db.staff.where('uuid').equals(remoteData.uuid || docSnap.id).first();
            if (!existingLocal) {
              const newId = await db.staff.add({
                username: remoteData.username,
                name: remoteData.name,
                role: remoteData.role,
                password: remoteData.password,
                uuid: remoteData.uuid || docSnap.id,
                updated_at: remoteData.updated_at || Date.now(),
                version: remoteData.version || 1
              });
              remoteData.id = newId;
            } else {
              await db.staff.update(existingLocal.id!, remoteData);
              remoteData.id = existingLocal.id;
            }

            if (matchesUsername(remoteData)) {
              staff = remoteData;
            }
          }
        }
      } catch (err) {
        console.warn('Error fetching staff from Firestore on login:', err);
      }
    }

    if (staff && verifyPassword(password, staff.password)) {
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
