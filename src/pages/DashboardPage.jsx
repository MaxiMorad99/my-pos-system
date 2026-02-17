import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

const DashboardPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  const [financials, setFinancials] = useState({
    totalInvested: 0,
    totalPotential: 0,
    potentialProfit: 0,
    stockCount: 0,
    lowStock: 0
  });

  const [inventoryList, setInventoryList] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: products, error } = await supabase.from('products').select('*');
      if (error) throw error;

      let invested = 0;
      let potential = 0;
      let lowStockCount = 0;

      products.forEach(p => {
        const qty = p.stock_current || 0;
        const cost = p.cost_price || 0;
        const price = p.price_sell || 0;

        invested += (cost * qty);
        potential += (price * qty);

        if (qty < 5) lowStockCount++;
      });

      setInventoryList(products);
      setFinancials({
        totalInvested: invested,
        totalPotential: potential,
        potentialProfit: potential - invested,
        stockCount: products.length,
        lowStock: lowStockCount
      });

    } catch (error) {
      console.error("Error dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = () => {
    const tableData = inventoryList.map(p => ({
      "Producto": p.name,
      "Código": p.barcode || "---",
      "Stock": p.stock_current,
      "Costo Unit.": p.cost_price || 0,
      "Precio Venta": p.price_sell,
      "Inversión ($)": (p.cost_price * p.stock_current) || 0,
      "Venta Total ($)": (p.price_sell * p.stock_current) || 0,
      "Ganancia ($)": ((p.price_sell - (p.cost_price || 0)) * p.stock_current) || 0
    }));

    const ws = XLSX.utils.json_to_sheet(tableData, { origin: "A5" });

    XLSX.utils.sheet_add_aoa(ws, [
      ["REPORTE DE INVENTARIO - POS SYSTEM"],
      ["Fecha de emisión:", new Date().toLocaleDateString()],
      [""],
      ["Detalle de Productos:"],
    ], { origin: "A1" });

    ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario Valorizado");
    XLSX.writeFile(wb, `Reporte_Financiero_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="p-4 md:p-8 bg-gray-100 min-h-screen">
      
      {/* CABECERA RESPONSIVE (Columna en móvil, Fila en PC) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
           <h1 className="text-2xl md:text-3xl font-bold text-gray-800">📊 Finanzas</h1>
           <p className="text-gray-500 text-sm mt-1">Control de capital y ganancias</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
            <button 
              onClick={downloadExcel} 
              className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-bold flex justify-center items-center gap-2 shadow-md text-sm md:text-base"
            >
              📋 <span className="hidden md:inline">Exportar Excel</span>
              <span className="md:hidden">Excel</span> {/* Texto corto en móvil */}
            </button>
            
            <button 
              onClick={fetchData} 
              className="bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-xl font-bold hover:bg-indigo-50 transition shadow-sm"
            >
              🔄
            </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500 animate-pulse">Calculando finanzas...</div>
      ) : (
        <>
          {/* TARJETAS DE DINERO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-blue-500">
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wide">Inversión (Costo)</p>
              <h2 className="text-3xl font-black text-gray-800 mt-1">
                ${financials.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </h2>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-indigo-500">
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wide">Venta Total</p>
              <h2 className="text-3xl font-black text-gray-800 mt-1">
                ${financials.totalPotential.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </h2>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-500">
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wide">Ganancia Estimada</p>
              <h2 className="text-3xl font-black text-green-600 mt-1">
                +${financials.potentialProfit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </h2>
            </div>
          </div>

          {/* ALERTA DE STOCK RESPONSIVE */}
          {financials.lowStock > 0 ? (
             <div className="bg-red-50 border border-red-200 rounded-xl p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4 animate-fadeIn">
                <div className="flex items-center gap-4 w-full">
                    <span className="text-3xl">🚨</span>
                    <div>
                        <h3 className="text-red-800 font-bold text-lg">Stock Crítico</h3>
                        <p className="text-red-600 text-sm">Tienes {financials.lowStock} productos por agotar.</p>
                    </div>
                </div>
                <button 
                  onClick={() => navigate('/inventory')} 
                  className="w-full md:w-auto text-center bg-white border border-red-200 text-red-700 font-bold py-2 px-4 rounded-lg text-sm hover:bg-red-50"
                >
                    Ver Inventario
                </button>
             </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 flex items-center gap-4">
                <span className="text-3xl">✅</span>
                <div>
                    <h3 className="text-green-800 font-bold text-lg">Todo Correcto</h3>
                    <p className="text-green-600 text-sm">Inventario saludable.</p>
                </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DashboardPage;