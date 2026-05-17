import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import React from 'react';

export default function PrivateRoute() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center font-mono text-zinc-500 uppercase tracking-widest animate-pulse">
      Carregando...
    </div>
  );

  // Se não estiver logado, manda pro login
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
