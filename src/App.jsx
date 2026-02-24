import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';

// Importación de páginas
import POSPage from './pages/POSPage';
import SalesPage from './pages/SalesPage';
import ProductsPage from './pages/ProductsPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/SettingsPage';

// NAVBAR INTEGRADO Y SEGURO
const Navbar = () => {
  const location = useLocation();
  const handleLogout = async () => await supabase.auth.signOut();
  const getLinkClass = (path) => `px-4 py-2 rounded-lg transition ${location.pathname === path ? 'bg-indigo-700' : 'hover:bg-indigo-600'}`;

  return (
    <nav className="bg-indigo-900 text-white p-4 shadow-lg mb-6">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <span className="text-xl font-bold">Jaimito Store</span>
          <Link to="/" className={getLinkClass('/')}>📊 Inicio</Link>
          <Link to="/pos" className={getLinkClass('/pos')}>🛒 Vender</Link>
          <Link to="/inventory" className={getLinkClass('/inventory')}>📦 Inventario</Link>
          <Link to="/sales" className={getLinkClass('/sales')}>📜 Historial</Link>
          <Link to="/settings" className={getLinkClass('/settings')}>⚙️ Ajustes</Link>
        </div>
        <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-lg font-bold">Salir</button>
      </div>
    </nav>
  );
};

const App = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificación inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Suscripción a cambios
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center font-bold">Iniciando sistema...</div>;

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        {session && <Navbar />}
        <Routes>
          <Route path="/login" element={!session ? <LoginPage /> : <Navigate to="/" />} />
          <Route path="/" element={session ? <DashboardPage /> : <Navigate to="/login" />} />
          <Route path="/pos" element={session ? <POSPage /> : <Navigate to="/login" />} />
          <Route path="/inventory" element={session ? <ProductsPage /> : <Navigate to="/login" />} />
          <Route path="/sales" element={session ? <SalesPage /> : <Navigate to="/login" />} />
          <Route path="/settings" element={session ? <SettingsPage /> : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;