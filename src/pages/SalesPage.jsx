import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const SalesPage = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [storeData, setStoreData] = useState(null);

  // Cargar Ventas y Datos de la Tienda al iniciar
  useEffect(() => {
    fetchSales();
    fetchStoreData();
  }, []);

  const fetchStoreData = async () => {
    const { data } = await supabase.from('store_settings').select('*').single();
    if (data) setStoreData(data);
  };

  const fetchSales = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id, 
          created_at, 
          total, 
          sale_items (
            quantity,
            price,
            products (name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSales(data || []);
    } catch (error) {
      console.error("Error:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- FUNCIÓN PARA REIMPRIMIR TICKET ---
  const handleReprint = (sale) => {
    const storeName = storeData?.name || "Mi Tienda";
    const storeAddress = storeData?.address || "";
    const storePhone = storeData?.phone || "";

    const printWindow = window.open('', '', 'width=400,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Reimpresión Ticket</title>
          <style>
            body { font-family: 'Courier New', monospace; text-align: center; font-size: 12px; margin: 0; padding: 10px; }
            .header { margin-bottom: 10px; border-bottom: 1px dashed black; padding-bottom: 10px; }
            .store-name { font-size: 16px; font-weight: bold; text-transform: uppercase; }
            .item { display: flex; justify-content: space-between; margin: 5px 0; }
            .total { font-size: 16px; font-weight: bold; margin-top: 15px; border-top: 1px dashed black; padding-top: 10px; }
            .footer { margin-top: 20px; font-size: 10px; color: #555; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="store-name">${storeName}</div>
            <div>${storeAddress}</div>
            <div>Tel: ${storePhone}</div>
            <br/>
            <div>Fecha: ${new Date(sale.created_at).toLocaleString()}</div>
            <div>Ticket ID: #${sale.id.slice(0, 8)}</div>
          </div>
          <div class="items">
            ${(sale.sale_items || []).map(item => `
              <div class="item">
                <span>${item.products?.name || "Producto"} (x${item.quantity})</span>
                <span>$${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
          <div class="total">TOTAL: $${(sale.total || 0).toFixed(2)}</div>
          <div class="footer">
            <p>*** COPIA REIMPRESA ***</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const toggleSale = (id) => {
    setExpandedSaleId(expandedSaleId === id ? null : id);
  };

  return (
    <div className="p-4 md:p-8 bg-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">📜 Historial de Ventas</h1>
        <button 
          onClick={fetchSales} 
          className="bg-white p-2 rounded-full shadow-sm hover:bg-gray-50 border border-gray-200 text-indigo-600"
          title="Actualizar lista"
        >
          🔄
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Encabezados */}
        <div className="grid grid-cols-3 bg-gray-50 p-4 border-b border-gray-200 font-bold text-gray-600 text-sm uppercase">
          <div>Fecha</div>
          <div className="text-center">Items</div>
          <div className="text-right">Total</div>
        </div>

        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Cargando ventas...</div>
          ) : sales.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No hay ventas registradas.</div>
          ) : (
            sales.map((sale) => (
              <div key={sale.id} className="transition hover:bg-gray-50">
                
                {/* FILA DE RESUMEN (Click para abrir) */}
                <div 
                  onClick={() => toggleSale(sale.id)}
                  className="grid grid-cols-3 p-4 cursor-pointer items-center group"
                >
                  <div className="text-sm font-medium text-gray-700">
                    {new Date(sale.created_at).toLocaleString()}
                    <span className="ml-2 text-xs text-indigo-400 group-hover:text-indigo-600">
                      {expandedSaleId === sale.id ? '🔼' : '🔽'}
                    </span>
                  </div>
                  <div className="text-center text-sm text-gray-500">
                    {sale.sale_items ? sale.sale_items.length : 0} prod.
                  </div>
                  <div className="text-right font-bold text-indigo-700">
                    ${(sale.total || 0).toFixed(2)}
                  </div>
                </div>

                {/* DETALLE DESPLEGABLE */}
                {expandedSaleId === sale.id && (
                  <div className="bg-indigo-50 p-4 border-t border-indigo-100 animate-fadeIn">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-bold text-indigo-800 uppercase">Detalle de Productos:</h4>
                      
                      {/* --- BOTÓN DE REIMPRIMIR --- */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation(); // Evita que se cierre el acordeón al hacer clic
                          handleReprint(sale);
                        }}
                        className="bg-white text-indigo-600 border border-indigo-200 px-3 py-1 rounded-lg text-xs font-bold shadow-sm hover:bg-indigo-100 flex items-center gap-1"
                      >
                        🖨️ Reimprimir Ticket
                      </button>
                    </div>
                    
                    <ul className="space-y-2 mb-2">
                      {sale.sale_items && sale.sale_items.map((item, index) => (
                        <li key={index} className="flex justify-between text-sm border-b border-indigo-100 pb-1 last:border-0">
                          <span className="text-gray-700">
                            <span className="font-bold">{item.quantity}x</span> {item.products?.name || "---"}
                          </span>
                          <span className="text-gray-600">
                            ${(item.price || 0).toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesPage;