import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const SalesPage = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [storeData, setStoreData] = useState(null);
  const [orgId, setOrgId] = useState(null);

  // 1. Cargar Datos Iniciales con Filtro de Empresa
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
        console.error("Error inicializando historial:", error);
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
      .eq('organization_id', organizationId)
      .single();
    if (data) setStoreData(data);
  };

  // 2. Traer las Ventas con el N° de Ticket Real
  const fetchSales = async (organizationId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          created_at,
          total,
          receipt_number,
          sale_items (
            quantity,
            price,
            products (name)
          )
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSales(data || []);
    } catch (error) {
      console.error("Error al cargar ventas:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Reimprimir Ticket (Sintaxis segura sin optional chaining)
  const handleReprint = (sale) => {
    const storeName = storeData && storeData.name ? storeData.name : "MI TIENDA";
    const legalName = storeData && storeData.legal_name ? storeData.legal_name : storeName;
    const cuit = storeData && storeData.cuit ? storeData.cuit : "00-00000000-0";
    const taxCat = storeData && storeData.tax_category ? storeData.tax_category : "Consumidor Final";
    const address = storeData && storeData.address ? storeData.address : "Dirección no configurada";
    const phone = storeData && storeData.phone ? storeData.phone : "Sin teléfono";

    const ticketNumber = sale.receipt_number ? sale.receipt_number : `0001-${sale.id.replace(/\D/g, '').slice(0, 9).padStart(9, '0')}`;
    const date = new Date(sale.created_at);

    const printWindow = window.open('', '', 'width=350,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Reimpresión Ticket #${ticketNumber}</title>
          <style>
            @page { margin: 0; }
            body { font-family: 'Courier New', Courier, monospace; width: 80mm; margin: 0 auto; padding: 5mm; font-size: 12px; line-height: 1.2; color: #000; }
            .text-center { text-align: center; }
            .text-left { text-align: left; }
            .font-bold { font-weight: bold; }
            .text-xl { font-size: 18px; }
            .text-lg { font-size: 16px; }
            .divider { border-bottom: 1px dashed #000; margin: 5px 0; }
            .item-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3px; }
          </style>
        </head>
        <body onload="window.print(); setTimeout(function(){ window.close(); }, 500);">
          <div class="text-center font-bold text-xl">${storeName}</div>
          <div class="text-center">${legalName}</div>
          <div class="text-center">CUIT: ${cuit}</div>
          <div class="text-center">IVA: ${taxCat}</div>
          <div class="text-center">${address}</div>
          <div class="text-center">Tel: ${phone}</div>
          <div class="divider"></div>
          <div class="text-left font-bold">COMPROBANTE NO FISCAL (COPIA)</div>
          <div class="text-left">TICKET N°: ${ticketNumber}</div>
          <div class="text-left">FECHA: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}</div>
          <div class="divider"></div>
          <div class="item-row font-bold"><span>DESCRIPCION (CANT)</span><span>TOTAL</span></div>
          <div class="divider"></div>
          ${(sale.sale_items || []).map(item => {
            const productName = item.products && item.products.name ? item.products.name : "Producto";
            return `
              <div class="item-row">
                <span>${productName} (x${item.quantity})</span>
                <span>$${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            `;
          }).join('')}
          <div class="divider"></div>
          <div class="item-row font-bold text-lg" style="margin-top: 10px;">
            <span>TOTAL:</span><span>$${(sale.total || 0).toFixed(2)}</span>
          </div>
          <div class="divider"></div>
          <div class="text-center" style="margin-top: 15px;">*** COPIA REIMPRESA ***</div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="p-4 md:p-8 bg-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">📜 Historial de Ventas</h1>
        <button onClick={() => orgId && fetchSales(orgId)} className="bg-white p-2 rounded-full shadow-sm hover:bg-gray-50 text-indigo-600">🔄</button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        
        <div className="grid grid-cols-4 bg-gray-50 p-4 border-b font-bold text-gray-600 text-sm uppercase">
          <div>Ticket N°</div>
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
                <div onClick={() => setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id)} className="grid grid-cols-4 p-4 cursor-pointer items-center group">
                  
                  <div className="text-sm font-bold text-indigo-600">
                    {sale.receipt_number ? sale.receipt_number : "Sin N°"}
                  </div>

                  <div className="text-sm text-gray-700">
                    {new Date(sale.created_at).toLocaleDateString()} {new Date(sale.created_at).toLocaleTimeString()}
                  </div>
                  <div className="text-center text-sm text-gray-500">
                    {sale.sale_items ? sale.sale_items.length : 0} prod.
                  </div>
                  <div className="text-right font-bold text-indigo-700 flex justify-end items-center gap-2">
                    ${(sale.total || 0).toFixed(2)}
                    <span className="text-xs text-indigo-400 group-hover:text-indigo-600">
                      {expandedSaleId === sale.id ? '🔼' : '🔽'}
                    </span>
                  </div>
                </div>

                {expandedSaleId === sale.id && (
                  <div className="bg-indigo-50 p-4 border-t border-indigo-100 animate-fadeIn">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-bold text-indigo-800 uppercase">Detalle de Productos:</h4>
                      <button onClick={(e) => { e.stopPropagation(); handleReprint(sale); }} className="bg-white text-indigo-600 border px-3 py-1 rounded-lg text-xs font-bold shadow-sm hover:bg-indigo-100">
                        🖨️ Reimprimir
                      </button>
                    </div>
                    <ul className="space-y-2 mb-2">
                      {sale.sale_items && sale.sale_items.map((item, index) => {
                        const productName = item.products && item.products.name ? item.products.name : "Producto Eliminado";
                        return (
                          <li key={index} className="flex justify-between text-sm border-b border-indigo-100 pb-1 last:border-0">
                            <span className="text-gray-700">
                              <span className="font-bold">{item.quantity}x</span> {productName}
                            </span>
                            <span className="text-gray-600 font-bold">${(item.price * item.quantity).toFixed(2)}</span>
                          </li>
                        );
                      })}
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
