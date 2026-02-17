import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const POSPage = () => {
  // Estados de Datos
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [storeData, setStoreData] = useState(null);
  
  // Estados de Carrito y Filtros
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null); // Categoría Principal
  const [selectedSubCategory, setSelectedSubCategory] = useState(null); // Subcategoría

  // --- 1. CARGA INICIAL ---
  useEffect(() => {
    fetchData();
  }, []);

  // --- 2. CALCULAR TOTAL ---
  useEffect(() => {
    const newTotal = cart.reduce((acc, item) => acc + (item.price_sell * item.quantity), 0);
    setTotal(newTotal);
  }, [cart]);

  const fetchData = async () => {
    // 1. Datos de la Tienda (para el ticket)
    const { data: store } = await supabase.from('store_settings').select('*').single();
    if (store) setStoreData(store);

    // 2. Categorías
    const { data: cats } = await supabase.from('categories').select('*').order('name');
    if (cats) setCategories(cats);

    // 3. Productos (Con info de su categoría para poder filtrar)
    const { data: prods } = await supabase
      .from('products')
      .select('*, categories(id, parent_id)') // Traemos ID y Padre de la categoría
      .gt('stock_current', 0) // Solo stock positivo
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

  // --- COBRAR (Lógica corregida con 'total' y 'price') ---
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      // 1. Guardar Venta
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{ total: total }]) 
        .select()
        .single();

      if (saleError) throw saleError;

      // 2. Guardar Items y Descontar Stock
      for (const item of cart) {
        await supabase.from('sale_items').insert([{
          sale_id: saleData.id,
          product_id: item.id,
          quantity: item.quantity,
          price: item.price_sell
        }]);

        const currentProduct = products.find(p => p.id === item.id);
        const newStock = currentProduct.stock_current - item.quantity;
        await supabase.from('products').update({ stock_current: newStock }).eq('id', item.id);
      }

      handlePrint(); 
      setCart([]);
      fetchData(); // Recargar stock
      alert('¡Venta Exitosa!');

    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handlePrint = () => {
    const storeName = storeData?.name || "Mi Tienda";
    const storeAddress = storeData?.address || "";
    const storePhone = storeData?.phone || "";

    const printWindow = window.open('', '', 'width=400,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Ticket</title>
          <style>
            body { font-family: 'Courier New', monospace; text-align: center; font-size: 12px; margin: 0; padding: 10px; }
            .header { margin-bottom: 10px; border-bottom: 1px dashed black; padding-bottom: 10px; }
            .store-name { font-size: 16px; font-weight: bold; text-transform: uppercase; }
            .item { display: flex; justify-content: space-between; margin: 5px 0; }
            .total { font-size: 16px; font-weight: bold; margin-top: 15px; border-top: 1px dashed black; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="store-name">${storeName}</div>
            <div>${storeAddress}</div>
            <div>Tel: ${storePhone}</div>
            <br/>
            <div>${new Date().toLocaleString()}</div>
          </div>
          <div class="items">
            ${cart.map(item => `
              <div class="item">
                <span>${item.name} x${item.quantity}</span>
                <span>$${(item.price_sell * item.quantity).toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
          <div class="total">TOTAL: $${total.toFixed(2)}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // --- FILTRADO INTELIGENTE ---
  const filteredProducts = products.filter(p => {
    // 1. Filtro por Texto (Buscador)
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.barcode && p.barcode.includes(searchTerm));
    
    // 2. Filtro por Categoría
    let matchesCategory = true;
    
    if (selectedSubCategory) {
      // Si hay subcategoría seleccionada, debe coincidir exacta
      matchesCategory = p.category_id === selectedSubCategory;
    } else if (selectedCategory) {
      // Si hay Categoría Padre seleccionada, mostramos sus productos directos Y los de sus hijos
      // (p.category_id es igual al padre O la categoría del producto tiene como padre al seleccionado)
      matchesCategory = p.category_id === selectedCategory || p.categories?.parent_id === selectedCategory;
    }

    return matchesSearch && matchesCategory;
  });

  // Sepamos cuáles son padres y cuáles hijos para pintar los botones
  const mainCategories = categories.filter(c => !c.parent_id);
  const subCategories = selectedCategory ? categories.filter(c => c.parent_id === selectedCategory) : [];

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden bg-gray-100">
      
      {/* IZQUIERDA: PRODUCTOS Y FILTROS */}
      <div className="w-full md:w-2/3 flex flex-col h-1/2 md:h-full">
        
        {/* BARRA SUPERIOR: Buscador + Categorías */}
        <div className="bg-white p-4 shadow-sm z-10">
          {/* Buscador */}
          <input 
            type="text" 
            placeholder="🔍 Buscar producto o escanear..." 
            className="w-full p-3 mb-3 rounded-xl border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {/* Pestañas de Categorías (Scroll Horizontal) */}
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

          {/* Subcategorías (Solo si hay padre seleccionado y tiene hijos) */}
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

        {/* GRILLA DE PRODUCTOS (Scrollable) */}
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

      {/* DERECHA: CARRITO (Igual que antes pero responsive) */}
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