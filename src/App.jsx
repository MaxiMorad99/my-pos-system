import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';

// Páginas
import POSPage from './pages/POSPage';
import SalesPage from './pages/SalesPage';
import ProductsPage from './pages/ProductsPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/SettingsPage';
import Navbar from './components/Navbar'; // Asegúrate de que el Navbar esté en esta ruta

const App = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificación de sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        {session && <Navbar />}
        <div className={session ? "container mx-auto p-4" : ""}>
          <Routes>
            <Route path="/login" element={!session ? <LoginPage /> : <Navigate to="/" />} />
            <Route path="/" element={session ? <DashboardPage /> : <Navigate to="/login" />} />
            <Route path="/pos" element={session ? <POSPage /> : <Navigate to="/login" />} />
            <Route path="/inventory" element={session ? <ProductsPage /> : <Navigate to="/login" />} />
            <Route path="/sales" element={session ? <SalesPage /> : <Navigate to="/login" />} />
            <Route path="/settings" element={session ? <SettingsPage /> : <Navigate to="/login" />} />
            <Route path="*" element={<Navigate to={session ? "/" : "/login"} />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;