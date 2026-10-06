import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import UsersPage from './pages/Users';
import UserDetailPage from './pages/UserDetail';
import ReceiptPage from './pages/ReceiptPage';
import AdminPage from './pages/Admin';
import LoginPage from './pages/Login';
import { seedDatabase } from './database/db';
import { syncService } from './services/syncService';

import { LogIn } from 'lucide-react';
import ConsultationPage from './pages/Consultation';

import ReadingPage from './pages/Reading';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useSync } from './hooks/useSync';
import { ErrorBoundary } from './components/ErrorBoundary';

function AppContent() {
  const { user, loading } = useAuth();
  useSync();

  useEffect(() => {
    seedDatabase();
    syncService.initRealtimeSync();
  }, []);

  if (loading) return null;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
          <Route path="/consultation" element={
            user ? (
              <Layout>
                <ConsultationPage />
              </Layout>
            ) : (
              <div className="min-h-screen bg-zinc-50 p-4 md:p-8">
                <div className="max-w-2xl mx-auto">
                  <button 
                    onClick={() => window.location.href = '/login'}
                    className="mb-8 flex items-center gap-2 text-zinc-500 font-bold hover:text-zinc-900 transition-all"
                  >
                    <LogIn className="w-5 h-5" />
                    Volver al Inicio
                  </button>
                  <ConsultationPage />
                </div>
              </div>
            )
          } />

          {/* Protected Routes */}
          <Route path="/" element={user ? <Layout><ReadingPage /></Layout> : <Navigate to="/login" />} />
          <Route path="/users" element={user ? <Layout><UsersPage /></Layout> : <Navigate to="/login" />} />
          <Route path="/users/:id" element={user ? <Layout><UserDetailPage /></Layout> : <Navigate to="/login" />} />
          <Route path="/recibo/:id" element={user ? <Layout><ReceiptPage /></Layout> : <Navigate to="/login" />} />
          <Route path="/admin" element={user ? <Layout><AdminPage /></Layout> : <Navigate to="/login" />} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
