import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const POSPage = () => {
  // Estados de Datos Principales
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [storeData, setStoreData] = useState(null);
  const [orgId, setOrgId] = useState(null); 
  
  // Estados de Gestión de Cajas
  const [registers, setRegisters] = useState([]);
  const [selectedRegister, setSelectedRegister] = useState(null); 
  const [showRegisterModal, setShowRegisterModal] = useState(true); 

  // Estados de Carrito y Filtros
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null); 
  const [selectedSubCategory, setSelectedSubCategory] = useState(null); 

  // --- 1. CARGA INICIAL (USUARIO, DATOS Y CAJAS) ---
  useEffect(() => {
    const initPOS = async () => {
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
            await fetchData(profile.organization_id);
            
            // Cargamos las cajas habilitadas desde la nueva tabla
            const { data: regs } = await supabase
              .from('cash_registers')
              .select('*')
              .eq('organization_id', profile.organization_id);
            setRegisters(regs || []);
          }
        }
      } catch (error) {
        console.error("Error inicializando POS:", error);
      }
    };

    initPOS();
  }, []);

  // --- 2. CÁLCULO DINÁMICO DEL TOTAL ---
  useEffect(() => {
    const newTotal = cart.reduce((acc, item) => acc + (item.price_sell * item.quantity), 0);
    setTotal(newTotal);
  }, [cart]);

  const fetchData = async (organizationId) => {
    // Ajustes de tienda para el ticket
    const { data: store } = await supabase
      .from('store_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .single();
    if (store) setStoreData(store);

    // Categorías para los botones de filtro
    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name');
    if (cats) setCategories(cats);

    // Productos con stock disponible
    const { data: prods } = await supabase
      .from('products')
      .select('*, categories(id, parent_id)')
      .eq('organization_id', organizationId)
      .gt('stock_current', 0) 
      .order('name');
    if (prods) setProducts(prods);
  };

  // --- 3. LÓGICA DE COBRO Y GENERACIÓN DE RECIBO ---
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!orgId || !selectedRegister) return alert("Por favor, selecciona una caja para continuar."); 

    try {
      // Contamos ventas totales para generar el número correlativo
      const { count } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId);

      const sequentialNum = (count || 0) + 1;
      const posPrefix = selectedRegister.prefix; // Ej: "0001"
      const invoiceNumber = String(sequentialNum).padStart(9, '0'); 
      const finalReceiptNumber = `${posPrefix}-${invoiceNumber}`;

      // A. Guardamos la Venta Principal
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{ 
          total: total,
          organization_id: orgId,
          receipt_number: finalReceiptNumber 
        }]) 
        .select().single();

      if (saleError) throw saleError;

      // B. Guardamos el detalle de los productos (sale_items)
      for (const item of cart) {
        const { error: itemError } = await supabase.from('sale_items').insert([{
          sale_id: saleData.id,
          product_id: item.id,
          quantity: item.quantity,
          price: item.price_sell,
          organization_id: orgId 
        }]);

        if (itemError) throw new Error(`Error en producto ${item.name}: ${itemError.message}`);

        // Actualizamos stock en tiempo real
        const currentProduct = products.find(p => p.id === item.id);
        const newStock = currentProduct.stock_current - item.quantity;
        await supabase.from('products').update({ stock_current: newStock }).eq('id', item.id);
      }
      
      // Lanzamos la impresión y limpiamos todo
      handlePrint(finalReceiptNumber); 
      setCart([]);
      fetchData(orgId); 
      alert('¡Venta Exitosa!');

    } catch (error) {
      alert('Error crítico al cobrar: ' + error.message);
    }
  };

  const handlePrint = (ticketNumber) => {
    const storeName = storeData?.name || "MI TIENDA";
    const legalName = storeData?.legal_name || storeName;
    const cuit = storeData?.cuit || "00-00000000-0";
    const taxCat = storeData?.tax_category || "Consumidor Final";
    const address = storeData?.address || "Dirección no configurada";

    const now = new Date();
    const printWindow = window.open('', '', 'width=350,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Ticket #${ticketNumber}</title>
          <style>
            @page { margin: 0; }
            body { font-family: 'Courier New', monospace; width: 80mm; margin: 0 auto; padding: 5mm; font-size: 12px; line-height: 1.2; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .divider { border-bottom: 1px dashed #000; margin: 5px 0; }
            .item-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="text-center font-bold" style="font-size:16px;">${storeName}</div>
          <div class="text-center">${legalName}</div>
          <div class="text-center">CUIT: ${cuit}</div>
          <div class="text-center">IVA: ${taxCat}</div>
          <div class="text-center">${address}</div>
          <div class="divider"></div>
          <div class="text-left font-bold">TICKET N°: ${ticketNumber}</div>
          <div class="text-left">FECHA: ${now.toLocaleString()}</div>
          <div class="divider"></div>
          ${cart.map(item => `<div class="item-row"><span>${item.name} x${item.quantity}</span><span>$${(item.price_sell * item.quantity).toFixed(2)}</span></div>`).join('')}
          <div class="divider"></div>
          <div class="item-row font-bold" style="font-size:14px;"><span>TOTAL:</span><span>$${total.toFixed(2)}</span></div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // --- 4. LÓGICA DE INTERFAZ Y FILTROS ---
  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock_current) return alert("¡Sin stock disponible!");
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  // Filtro dinámico por nombre, código de barras o categorías
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.barcode && p.barcode.includes(searchTerm));
    
    let matchesCategory = true;
    if (selectedSubCategory) {
      matchesCategory = p.category_id === selectedSubCategory;
    } else if (selectedCategory) {
      matchesCategory = p.category_id === selectedCategory || p.categories?.parent_id === selectedCategory;
    }

    return matchesSearch && matchesCategory;
  });

  const mainCategories = categories.filter(c => !c.parent_id);
  const subCategories = selectedCategory ? categories.filter(c => c.parent_id === selectedCategory) : [];

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden bg-gray-100">
      
      {/* MODAL DE BIENVENIDA: SELECCIÓN DE CAJA */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[100]">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl text-center">
            <span className="text-5xl block mb-4">🏧</span>
            <h2 className="text-2xl font-black text-gray-800 mb-2">Seleccionar Caja</h2>
            <p className="text-gray-500 mb-6">Elige la terminal de cobro para hoy.</p>
            
            <div className="space-y-3">
              {registers.map(reg => (
                <button
                  key={reg.id}
                  onClick={() => { setSelectedRegister(reg); setShowRegisterModal(false); }}
                  className="w-full p-4 border-2 border-gray-100 rounded-2xl flex justify-between items-center hover:border-indigo-500 hover:bg-indigo-50 transition font-bold text-gray-700"
                >
                  <div className="text-left">
                    <div className="text-indigo-600 font-bold">{reg.name}</div>
                    <div className="text-xs text-gray-400">Prefijo: {reg.prefix}</div>
                  </div>
                  <span className="text-xl">➡️</span>
                </button>
              ))}
              {registers.length === 0 && (
                <p className="text-red-500 italic p-4 bg-red-50 rounded-xl">No hay cajas habilitadas en Supabase.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ÁREA IZQUIERDA: PRODUCTOS Y FILTROS */}
      <div className="w-full md:w-2/3 flex flex-col h-1/2 md:h-full">
        <div className="bg-white p-4 shadow-sm z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-indigo-100 px-3 py-2 rounded-xl text-xs font-bold text-indigo-700 whitespace-nowrap">
              CAJA: {selectedRegister?.name || 'SIN SELECCIONAR'}
            </div>
            <input 
              type="text" 
              placeholder="🔍 Buscar producto o escanear..." 
              className="flex-1 p-3 rounded-xl border border-gray-300 bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filtros de Categorías */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button 
              onClick={() => { setSelectedCategory(null); setSelectedSubCategory(null); }}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap ${!selectedCategory ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              Todo
            </button>
            {mainCategories.map(cat => (
              <button 
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setSelectedSubCategory(null); }}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap ${selectedCategory === cat.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {subCategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto mt-2 pt-2 border-t border-gray-100">
              {subCategories.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubCategory(selectedSubCategory === sub.id ? null : sub.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border ${selectedSubCategory === sub.id ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-500'}`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredProducts.map(product => (
              <div key={product.id} onClick={() => addToCart(product)} className="bg-white p-4 rounded-2xl shadow-sm border border-transparent hover:border-indigo-500 cursor-pointer transition active:scale-95">
                <div className="text-2xl mb-2">📦</div>
                <h3 className="font-bold text-sm text-gray-800 line-clamp-2 mb-1">{product.name}</h3>
                <div className="flex justify-between items-end">
                  <span className="text-indigo-700 font-black text-lg">${product.price_sell}</span>
                  <span className="text-[10px] text-gray-400 bg-gray-50 px-2 rounded-full">Stock: {product.stock_current}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ÁREA DERECHA: CARRITO DE VENTA */}
      <div className="w-full md:w-1/3 bg-white border-l border-gray-200 flex flex-col h-full shadow-2xl">
        <div className="p-4 bg-indigo-900 text-white flex justify-between items-center">
          <h2 className="font-bold text-lg">Ticket de Venta</h2>
          <button onClick={() => setCart([])} className="text-xs bg-indigo-800 px-2 py-1 rounded hover:bg-indigo-700">Limpiar</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.map(item => (
            <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div className="flex-1">
                <h4 className="font-bold text-gray-800 text-sm">{item.name}</h4>
                <div className="text-xs text-indigo-600 font-bold mt-1">x{item.quantity} - ${(item.price_sell * item.quantity).toFixed(2)}</div>
              </div>
              <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-red-400 text-xs ml-2">✕</button>
            </div>
          ))}
          {cart.length === 0 && <div className="text-center text-gray-400 mt-10 italic">Carrito vacío</div>}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold text-gray-600">TOTAL A PAGAR</span>
            <span className="text-3xl font-black text-indigo-900">${total.toFixed(2)}</span>
          </div>
          <button 
            onClick={handleCheckout} 
            disabled={cart.length === 0} 
            className={`w-full py-4 rounded-2xl font-bold text-xl shadow-lg transition transform active:scale-95 ${cart.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
          >
            💵 Cobrar Venta
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSPage;