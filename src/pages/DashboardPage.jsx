import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const DashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalSales: 0,
    totalItems: 0,
    averageTicket: 0
  });
  const [topProducts, setTopProducts] = useState([]);
  const [salesByRegister, setSalesByRegister] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [storeName, setStoreName] = useState("Mi Negocio");

  // Paleta de colores para los gráficos
  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single();

        if (!profile?.organization_id) return;
        const orgId = profile.organization_id;

        // 1. Obtener nombre de la tienda
        const { data: store } = await supabase.from('store_settings').select('name').eq('organization_id', orgId).single();
        if (store) setStoreName(store.name);

        // 2. Obtener ventas y cajas
        const { data: salesData } = await supabase.from('sales').select('*').eq('organization_id', orgId).order('created_at', { ascending: false });
        const { data: registersData } = await supabase.from('cash_registers').select('*').eq('organization_id', orgId);
        
        // 3. Obtener el detalle de productos
        const { data: itemsData } = await supabase.from('sale_items').select('*, products(name)').eq('organization_id', orgId);

        if (salesData && itemsData) {
          // --- KPIs ---
          const totalRev = salesData.reduce((acc, curr) => acc + (curr.total || 0), 0);
          const totalItemsSold = itemsData.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
          
          setStats({
            totalRevenue: totalRev,
            totalSales: salesData.length,
            totalItems: totalItemsSold,
            averageTicket: salesData.length > 0 ? (totalRev / salesData.length) : 0
          });

          setRecentSales(salesData.slice(0, 5));

          // --- RANKING TOP PRODUCTOS (Para Gráfico de Barras) ---
          const productCounts = {};
          itemsData.forEach(item => {
            const name = item.products?.name || 'Producto Eliminado';
            productCounts[name] = (productCounts[name] || 0) + item.quantity;
          });
          
          const sortedProducts = Object.entries(productCounts)
            .map(([name, qty]) => ({ name, Cantidad: qty }))
            .sort((a, b) => b.Cantidad - a.Cantidad)
            .slice(0, 5); 
          
          setTopProducts(sortedProducts);

          // --- VENTAS POR SUCURSAL/CAJA (Para Gráfico Circular) ---
          const registerCounts = {};
          salesData.forEach(sale => {
            const prefix = sale.receipt_number ? sale.receipt_number.split('-')[0] : 'Sin N°';
            registerCounts[prefix] = (registerCounts[prefix] || 0) + (sale.total || 0);
          });

          const sortedRegisters = Object.entries(registerCounts).map(([prefix, amount]) => {
            const regInfo = registersData?.find(r => r.prefix === prefix);
            return {
              name: regInfo ? regInfo.name : (prefix === 'Sin N°' ? 'Ventas Antiguas' : `Caja ${prefix}`),
              value: amount
            };
          }).sort((a, b) => b.value - a.value);

          setSalesByRegister(sortedRegisters);
        }
      } catch (error) {
        console.error("Error al cargar dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-xl text-indigo-600 font-bold animate-pulse">Analizando métricas...</p></div>;
  }

  // Personalización del Tooltip del gráfico circular para que muestre el signo $
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg">
          <p className="font-bold text-gray-800">{payload[0].name}</p>
          <p className="text-indigo-600 font-black">${payload[0].value.toFixed(2)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 md:p-8 bg-gray-100 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-800">👋 Hola, {storeName}</h1>
        <p className="text-gray-500 mt-1">Aquí tienes el resumen del rendimiento de tu negocio.</p>
      </div>

      {/* 1. TARJETAS DE MÉTRICAS (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition">
          <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-2xl">💰</div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ingresos Totales</p>
            <p className="text-2xl font-black text-gray-800">${stats.totalRevenue.toFixed(2)}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition">
          <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl">🧾</div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ventas Emitidas</p>
            <p className="text-2xl font-black text-gray-800">{stats.totalSales}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition">
          <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-2xl">📦</div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Artículos Vendidos</p>
            <p className="text-2xl font-black text-gray-800">{stats.totalItems}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition">
          <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-2xl">📊</div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ticket Promedio</p>
            <p className="text-2xl font-black text-gray-800">${stats.averageTicket.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* 2. GRÁFICO: TOP 5 PRODUCTOS */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-96 flex flex-col">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">🏆 Top 5 Productos Más Vendidos</h2>
          <div className="flex-1 w-full h-full">
            {topProducts.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 italic">No hay datos suficientes.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="Cantidad" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40}>
                    {topProducts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 3. GRÁFICO: INGRESOS POR SUCURSAL/CAJA */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-96 flex flex-col">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">🏧 Ingresos por Sucursal</h2>
          <div className="flex-1 w-full h-full">
            {salesByRegister.length === 0 ? (
               <div className="flex items-center justify-center h-full text-gray-400 italic">No hay datos suficientes.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesByRegister}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {salesByRegister.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* 4. ÚLTIMAS VENTAS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">⚡ Ventas Recientes</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {recentSales.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No hay ventas registradas todavía.</div>
          ) : (
            recentSales.map((sale) => (
              <div key={sale.id} className="p-4 md:p-6 flex justify-between items-center hover:bg-indigo-50 transition cursor-default group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white border border-gray-100 shadow-sm rounded-full flex items-center justify-center text-xl group-hover:scale-110 transition">🧾</div>
                  <div>
                    <p className="text-sm font-bold text-indigo-700">{sale.receipt_number || "Ticket Antiguo"}</p>
                    <p className="text-xs text-gray-500 font-medium">{new Date(sale.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right font-black text-gray-800 text-lg">
                  ${(sale.total || 0).toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default DashboardPage;