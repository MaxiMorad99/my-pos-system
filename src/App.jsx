import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';

// Importamos las páginas
import POSPage from './pages/POSPage';
import SalesPage from './pages/SalesPage';
import ProductsPage from './pages/ProductsPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/SettingsPage';

// --- NAVBAR SIMPLE (A PRUEBA DE ERRORES) ---
const Navbar = () => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // 1. Usamos valores por defecto para que NO dependa de la base de datos para cargar
  const [store, setStore] = useState({ name: 'Jaimito Store', logo_url: null });

  useEffect(() => {
    // Intentamos cargar el nombre, pero si falla, NO hacemos nada (así no se rompe)
    const loadSettings = async () => {
      try {
        const { data } = await supabase.from('store_settings').select('name, logo_url').limit(1).maybeSingle();
        if (data) setStore(data);
      } catch {
        console.log("Usando nombre por defecto para evitar error");
      }
    };
    loadSettings();
  }, []);

  const getLinkClass = (path, isMobile = false) => {
    const baseClass = isMobile 
      ? "block w-full py-3 px-4 hover:bg-indigo-800 text-left" 
      : "px-4 py-2 rounded-lg font-medium transition hover:bg-indigo-600";
    const activeClass = location.pathname === path 
      ? (isMobile ? "bg-indigo-800 border-l-4 border-white" : "bg-indigo-700 shadow-inner") 
      : "";
    return `${baseClass} ${activeClass}`;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <nav className="bg-indigo-900 text-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          
          {/* LOGO Y NOMBRE */}
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <h1 className="font-bold text-lg md:text-xl tracking-tight truncate max-w-[200px]">
              {store.name}
            </h1>
          </div>

          {/* MENU MOVIL */}
          <button 
            className="md:hidden p-2 rounded-md hover:bg-indigo-800 focus:outline-none"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <span className="text-2xl">☰</span>
          </button>

          {/* MENU PC */}
          <div className="hidden md:flex gap-2 items-center">
            <Link to="/" className={getLinkClass('/')}>📊 Inicio</Link>
            <Link to="/pos" className={getLinkClass('/pos')}>🛒 Vender</Link>
            <Link to="/inventory" className={getLinkClass('/inventory')}>📦 Inventario</Link>
            <Link to="/sales" className={getLinkClass('/sales')}>📜 Historial</Link>
            <Link to="/settings" className={getLinkClass('/settings')}>⚙️ Ajustes</Link>
            <div className="h-6 w-px bg-indigo-700 mx-2"></div>
            <button onClick={handleLogout} className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg font-bold text-sm transition shadow-sm">Salir</button>
          </div>
        </div>

        {/* DESPLEGABLE MOVIL */}
        {isMenuOpen && (
          <div className="md:hidden pb-4 bg-indigo-900 border-t border-indigo-800">
            <div className="flex flex-col space-y-1 mt-2">
              <Link to="/" onClick={() => setIsMenuOpen(false)} className={getLinkClass('/', true)}>📊 Inicio</Link>
              <Link to="/pos" onClick={() => setIsMenuOpen(false)} className={getLinkClass('/pos', true)}>🛒 Vender</Link>
              <Link to="/inventory" onClick={() => setIsMenuOpen(false)} className={getLinkClass('/inventory', true)}>📦 Inventario</Link>
              <Link to="/sales" onClick={() => setIsMenuOpen(false)} className={getLinkClass('/sales', true)}>📜 Historial</Link>
              <Link to="/settings" onClick={() => setIsMenuOpen(false)} className={getLinkClass('/settings', true)}>⚙️ Ajustes</Link>
              <div className="border-t border-indigo-800 my-2 pt-2 px-4">
                <button onClick={handleLogout} className="w-full text-left py-2 text-red-300 font-bold hover:text-red-100">Cerrar Sesión</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

// --- APP PRINCIPAL ---
const App = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center text-gray-500">Cargando...</div>;

  if (!session) {
    return <LoginPage />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 overflow-x-hidden p-2 md:p-0">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/pos" element={<POSPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/inventory" element={<ProductsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<DashboardPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;