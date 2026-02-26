import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const POSPage = () => {
  // Estados de Datos
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [storeData, setStoreData] = useState(null);
  const [orgId, setOrgId] = useState(null); 
  
  // Estados de Carrito y Filtros
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null); 
  const [selectedSubCategory, setSelectedSubCategory] = useState(null); 

  // --- 1. CARGA INICIAL ---
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
          }
        }
      } catch (error) {
        console.error("Error inicializando POS:", error);
      }
    };

    initPOS();
  }, []);

  // --- 2. CALCULAR TOTAL ---
  useEffect(() => {
    const newTotal = cart.reduce((acc, item) => acc + (item.price_sell * item.quantity), 0);
    setTotal(newTotal);
  }, [cart]);

  const fetchData = async (organizationId) => {
    // 1. Datos de la Tienda (para el ticket)
    const { data: store } = await supabase
      .from('store_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .single();
    if (store) setStoreData(store);

    // 2. Categorías
    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name');
    if (cats) setCategories(cats);

    // 3. Productos 
    const { data: prods } = await supabase
      .from('products')
      .select('*, categories(id, parent_id)') 
      .eq('organization_id', organizationId)
      .gt('stock_current', 0) 
      .order('name');
      
    if (prods) setProducts(prods);
  };

  // --- LÓGICA DEL CARRITO ---
  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock_current) {
        alert("¡No hay más stock disponible!");
        return;
      }
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const updateQuantity = (id, newQuantity) => {
    if (newQuantity < 1) return;
    setCart(cart.map(item => item.id === id ? { ...item, quantity: newQuantity } : item));
  };

  // --- COBRAR Y GENERAR NÚMERO DE TICKET ---
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!orgId) return alert("Error de seguridad: No se detectó tu empresa."); 

    try {
      // 1. Guardar Venta
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{ 
          total: total,
          organization_id: orgId 
        }]) 
        .select()
        .single();

      if (saleError) throw saleError;

      // 2. Guardar Items (AHORA CON ORGANIZACIÓN Y CONTROL DE ERRORES)
      for (const item of cart) {
        const { error: itemError } = await supabase.from('sale_items').insert([{
          sale_id: saleData.id,
          product_id: item.id,
          quantity: item.quantity,
          price: item.price_sell,
          organization_id: orgId // <--- ESTO FALTABA PARA QUE NO LOS RECHACE
        }]);

        if (itemError) {
          console.error("Error guardando detalle:", itemError);
          throw new Error("No se pudo guardar un producto: " + itemError.message);
        }

        const currentProduct = products.find(p => p.id === item.id);
        const newStock = currentProduct.stock_current - item.quantity;
        await supabase.from('products').update({ stock_current: newStock }).eq('id', item.id);
      }

      // 3. Contar ventas y generar ticket
      const { count } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId);

      const sequentialNum = count || 1;
      
      handlePrint(sequentialNum); 
      setCart([]);
      fetchData(orgId); 
      alert('¡Venta Exitosa!');

    } catch (error) {
      alert('Error al cobrar: ' + error.message);
    }
  };

  // --- GENERADOR DE TICKET TÉRMICO PROFESIONAL ---
  const handlePrint = (saleId) => {
    // Extraemos los datos de la tienda, con valores por defecto si faltan
    const storeName = storeData?.name || "MI TIENDA";
    const legalName = storeData?.legal_name || storeName;
    const cuit = storeData?.cuit || "00-00000000-0";
    const taxCat = storeData?.tax_category || "Consumidor Final";
    const address = storeData?.address || "Dirección no configurada";
    const phone = storeData?.phone || "Sin teléfono";
    
    // Generamos un N° de Ticket basado en la fecha (Ej: 20260226-0012)
    const now = new Date();
    const dateString = now.toLocaleDateString();
    const timeString = now.toLocaleTimeString();
    const ticketNumber = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${saleId.toString().padStart(4, '0')}`;

    const printWindow = window.open('', '', 'width=350,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Ticket #${ticketNumber}</title>
          <style>
            /* Estilos optimizados para impresora térmica de 80mm */
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
          
          <div class="text-left font-bold">COMPROBANTE NO FISCAL</div>
          <div class="text-left">TICKET N°: ${ticketNumber}</div>
          <div class="text-left">FECHA: ${dateString} ${timeString}</div>
          
          <div class="divider"></div>
          
          <div class="item-row font-bold">
            <span class="item-name">DESCRIPCION (CANT)</span>
            <span class="item-total">TOTAL</span>
          </div>
          
          <div class="divider"></div>
          
          ${cart.map(item => `
            <div class="item-row">
              <span class="item-name">${item.name} (x${item.quantity})</span>
              <span class="item-total">$${(item.price_sell * item.quantity).toFixed(2)}</span>
            </div>
            <div class="text-left" style="font-size: 10px; color: #444; margin-bottom: 5px;">
              P. Unit: $${parseFloat(item.price_sell).toFixed(2)}
            </div>
          `).join('')}
          
          <div class="divider"></div>
          
          <div class="item-row font-bold text-lg" style="margin-top: 10px;">
            <span>TOTAL A PAGAR:</span>
            <span>$${total.toFixed(2)}</span>
          </div>
          
          <div class="divider"></div>
          
          <div class="text-center" style="margin-top: 15px;">
            ¡Gracias por su compra!
          </div>
          <div class="text-center" style="margin-top: 5px; font-size: 10px;">
            Documento válido como remito interno.
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

  // --- FILTRADO INTELIGENTE ---
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
      
      {/* IZQUIERDA: PRODUCTOS Y FILTROS */}
      <div className="w-full md:w-2/3 flex flex-col h-1/2 md:h-full">
        
        {/* BARRA SUPERIOR: Buscador + Categorías */}
        <div className="bg-white p-4 shadow-sm z-10">
          <input 
            type="text" 
            placeholder="🔍 Buscar producto o escanear..." 
            className="w-full p-3 mb-3 rounded-xl border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            <button 
              onClick={() => { setSelectedCategory(null); setSelectedSubCategory(null); }}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition ${!selectedCategory ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Todo
            </button>
            {mainCategories.map(cat => (
              <button 
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setSelectedSubCategory(null); }}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition ${selectedCategory === cat.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {subCategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto mt-2 pt-2 border-t border-gray-100 animate-fadeIn">
              <span className="text-xs font-bold text-gray-400 py-2 self-center">Filtrar:</span>
              {subCategories.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubCategory(selectedSubCategory === sub.id ? null : sub.id)}
                  className={`px-3 py-1 rounded-lg whitespace-nowrap text-xs font-bold border transition ${selectedSubCategory === sub.id ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-500 border-gray-200'}`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* GRILLA DE PRODUCTOS */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredProducts.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
              <p className="text-4xl mb-2">🔍</p>
              <p>No se encontraron productos.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {filteredProducts.map(product => (
                <div 
                  key={product.id} 
                  onClick={() => addToCart(product)}
                  className="bg-white p-3 md:p-4 rounded-xl shadow-sm hover:shadow-md cursor-pointer border border-transparent hover:border-indigo-500 transition active:scale-95 flex flex-col justify-between h-full"
                >
                  <div>
                    <div className="h-10 w-10 md:h-12 md:w-12 bg-indigo-50 rounded-full flex items-center justify-center text-xl md:text-2xl mb-2">📦</div>
                    <h3 className="font-bold text-gray-800 text-sm md:text-base leading-tight mb-1">{product.name}</h3>
                    <p className="text-xs text-gray-500 mb-2">{product.barcode}</p>
                  </div>
                  <div className="flex justify-between items-end mt-2">
                    <span className="text-indigo-700 font-bold text-base md:text-lg">${product.price_sell}</span>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">Stock: {product.stock_current}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* DERECHA: CARRITO */}
      <div className="w-full md:w-1/3 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col h-1/2 md:h-full shadow-2xl z-20">
        <div className="p-4 bg-indigo-900 text-white shadow-md flex justify-between items-center">
          <div>
            <h2 className="text-lg md:text-xl font-bold">Ticket de Venta</h2>
            <p className="text-indigo-200 text-xs md:text-sm">{cart.length} Artículos</p>
          </div>
          <button onClick={() => setCart([])} className="text-xs bg-indigo-800 hover:bg-indigo-700 px-2 py-1 rounded">Limpiar</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
              <span className="text-4xl block mb-2">🛒</span>
              Carrito vacío
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800 text-sm truncate">{item.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 bg-gray-200 rounded text-gray-600 font-bold">-</button>
                    <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 bg-gray-200 rounded text-gray-600 font-bold">+</button>
                  </div>
                </div>
                <div className="text-right ml-2">
                  <div className="font-bold text-gray-800">${(item.price_sell * item.quantity).toFixed(2)}</div>
                  <button onClick={() => removeFromCart(item.id)} className="text-red-500 text-xs mt-1">Eliminar</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-600 font-bold">Total a Pagar</span>
            <span className="text-3xl font-black text-indigo-900">${total.toFixed(2)}</span>
          </div>
          <button 
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`w-full py-3 md:py-4 rounded-xl font-bold text-lg shadow-lg transition transform active:scale-95 ${
              cart.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            💵 Cobrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSPage;