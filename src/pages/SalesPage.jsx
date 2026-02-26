import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const SalesPage = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [storeData, setStoreData] = useState(null);
  const [orgId, setOrgId] = useState(null); // <-- AÑADIDO: Estado para la empresa

  // Cargar Ventas y Datos de la Tienda al iniciar (Ahora con filtro de empresa)
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();
            
          if (profile && profile.organization_id) {
            setOrgId(profile.organization_id);
            await fetchStoreData(profile.organization_id);
            await fetchSales(profile.organization_id);
          }
        }
      } catch (error) {
        console.error("Error inicializando:", error);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  const fetchStoreData = async (organizationId) => {
    const { data } = await supabase
      .from('store_settings')
      .select('*')
      .eq('organization_id', organizationId) // <-- Filtro de seguridad
      .single();
    if (data) setStoreData(data);
  };

  const fetchSales = async (organizationId) => {
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
        .eq('organization_id', organizationId) // <-- Filtro de seguridad
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSales(data || []);
    } catch (error) {
      console.error("Error:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- FUNCIÓN PARA REIMPRIMIR TICKET (AHORA CON FORMATO FISCAL) ---
  const handleReprint = (sale) => {
    const storeName = storeData?.name || "MI TIENDA";
    const legalName = storeData?.legal_name || storeName;
    const cuit = storeData?.cuit || "00-00000000-0";
    const taxCat = storeData?.tax_category || "Consumidor Final";
    const address = storeData?.address || "Dirección no configurada";
    const phone = storeData?.phone || "Sin teléfono";

    // Generamos un falso número de ticket secuencial extrayendo números del ID real para mantener el formato visual
    const onlyNumbersId = sale.id.replace(/\D/g, '').slice(0, 8).padStart(8, '0');
    const ticketNumber = `0001-${onlyNumbersId}`;

    const date = new Date(sale.created_at);
    const dateString = date.toLocaleDateString();
    const timeString = date.toLocaleTimeString();

    const printWindow = window.open('', '', 'width=350,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Reimpresión Ticket #${ticketNumber}</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: 80mm; 
              margin: 0 auto; 
              padding: 5mm; 
              font-size: 12px; 
              line-height: 1.2;
              color: #000;
            }
            .text-center { text-align: center; }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .text-lg { font-size: 16px; }
            .text-xl { font-size: 18px; }
            .divider { border-bottom: 1px dashed #000; margin: 5px 0; }
            .item-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3px; }
            .item-name { flex: 1; padding-right: 5px; }
            .item-total { width: 60px; text-align: right; }
          </style>
        </head>
        <body>
          <div class="text-center font-bold text-xl">${storeName}</div>
          <div class="text-center">${legalName}</div>
          <div class="text-center">CUIT: ${cuit}</div>
          <div class="text-center">IVA: ${taxCat}</div>
          <div class="text-center">${address}</div>
          <div class="text-center">Tel: ${phone}</div>
          
          <div class="divider"></div>
          
          <div class="text-left font-bold">COMPROBANTE NO FISCAL (COPIA)</div>
          <div class="text-left">TICKET N°: ${ticketNumber}</div>
          <div class="text-left">FECHA: ${dateString} ${timeString}</div>
          
          <div class="divider"></div>
          
          <div class="item-row font-bold">
            <span class="item-name">DESCRIPCION (CANT)</span>
            <span class="item-total">TOTAL</span>
          </div>
          
          <div class="divider"></div>
          
          ${(sale.sale_items || []).map(item => `
            <div class="item-row">
              <span class="item-name">${item.products?.name || "Producto Eliminado"} (x${item.quantity})</span>
              <span class="item-total">$${(item.price * item.quantity).toFixed(2)}</span>
            </div>
            <div class="text-left" style="font-size: 10px; color: #444; margin-bottom: 5px;">
              P. Unit: $${parseFloat(item.price).toFixed(2)}
            </div>
          `).join('')}
          
          <div class="divider"></div>
          
          <div class="item-row font-bold text-lg" style="margin-top: 10px;">
            <span>TOTAL A PAGAR:</span>
            <span>$${(sale.total || 0).toFixed(2)}</span>
          </div>
          
          <div class="divider"></div>
          
          <div class="text-center" style="margin-top: 15px;">
            *** COPIA REIMPRESA ***
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function(){ window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const toggleSale = (id) => {
    setExpandedSaleId(expandedSaleId === id ? null : id);
  };

  return (
    <div className="p-4 md:p-8 bg-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">📜 Historial de Ventas</h1>
        <button 
          onClick={() => orgId && fetchSales(orgId)} 
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
                  <div className="text-sm font-medium text-gray-700 flex flex-col md:flex-row md:items-center">
                    <span>{new Date(sale.created_at).toLocaleDateString()}</span>
                    <span className="text-xs text-gray-400 md:ml-2">{new Date(sale.created_at).toLocaleTimeString()}</span>
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
                          e.stopPropagation(); 
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
                            <span className="font-bold">{item.quantity}x</span> {item.products?.name || "Producto Eliminado"}
                          </span>
                          <span className="text-gray-600 font-bold">
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                        </li>
                      ))}
                      {(!sale.sale_items || sale.sale_items.length === 0) && (
                        <li className="text-sm text-red-500 italic">Error: Detalle no disponible.</li>
                      )}
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