import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState(null); // <--- AQUÍ GUARDAMOS TU ID DE EMPRESA
  
  // Modales
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Formularios
  const [productForm, setProductForm] = useState({
    name: '', barcode: '', cost_price: '', price_sell: '', stock_current: '', category_id: ''
  });
  
  const [categoryForm, setCategoryForm] = useState({
    name: '', parent_id: ''
  });

  // --- CARGA DE DATOS ---
  useEffect(() => {
    // 1. PRIMERO: Obtener el ID de la Organización del usuario actual
    const fetchOrgAndData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Buscamos a qué organización pertenece este usuario
          const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();
            
          if (profile && profile.organization_id) {
            setOrgId(profile.organization_id);
            // Ahora sí, cargamos los datos de esa organización
            await fetchData(profile.organization_id);
          } else {
            console.error("No se encontró organización para el usuario");
          }
        }
      } catch (error) {
        console.error("Error inicializando:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrgAndData();
  }, []);

  const fetchData = async (organizationId) => {
    try {
      // Cargar Productos
      const { data: prodData, error: prodError } = await supabase
        .from('products')
        .select('*, categories(name)')
        .eq('organization_id', organizationId) // Filtramos por tu empresa
        .order('name');
        
      if (prodError) throw prodError;

      // Cargar Categorías
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .eq('organization_id', organizationId) // Filtramos por tu empresa
        .order('name');

      if (catError) throw catError;

      setProducts(prodData || []);
      setCategories(catData || []);
    } catch (error) {
      console.error("Error cargando datos:", error.message);
    }
  };

  // --- GESTIÓN DE CATEGORÍAS ---
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) return alert("Escribe un nombre");
    if (!orgId) return alert("Error: No se identificó la organización. Recarga la página.");

    const payload = {
      name: categoryForm.name,
      parent_id: categoryForm.parent_id || null,
      organization_id: orgId // <--- ¡ESTO FALTABA!
    };

    const { error } = await supabase.from('categories').insert([payload]);
    
    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("Categoría guardada");
      setCategoryForm({ name: '', parent_id: '' });
      fetchData(orgId); 
    }
  };

  // --- GESTIÓN DE PRODUCTOS ---
  const handleOpenProductModal = (product = null) => {
    setEditingProduct(product);
    if (product) {
      setProductForm({
        name: product.name,
        barcode: product.barcode || '',
        cost_price: product.cost_price || '',
        price_sell: product.price_sell,
        stock_current: product.stock_current,
        category_id: product.category_id || ''
      });
    } else {
      setProductForm({ name: '', barcode: '', cost_price: '', price_sell: '', stock_current: '', category_id: '' });
    }
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!orgId) return alert("Error: No se identificó la organización.");

    try {
      const payload = { 
        ...productForm, 
        category_id: productForm.category_id || null,
        organization_id: orgId // <--- ¡Aseguramos que el producto también la tenga!
      };
      
      let error;

      if (editingProduct) {
        const { error: upError } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
        error = upError;
      } else {
        const { error: inError } = await supabase.from('products').insert([payload]);
        error = inError;
      }

      if (error) throw error;
      
      setShowProductModal(false);
      fetchData(orgId);
      alert(editingProduct ? "Producto actualizado" : "Producto creado");
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const handleDeleteProduct = async (id, name) => {
    if (window.confirm(`¿Eliminar "${name}"?`)) {
      await supabase.from('products').delete().eq('id', id);
      fetchData(orgId);
    }
  };

  const handleProductChange = (e) => setProductForm({ ...productForm, [e.target.name]: e.target.value });
  const handleCategoryChange = (e) => setCategoryForm({ ...categoryForm, [e.target.name]: e.target.value });

  const mainCategories = categories.filter(c => !c.parent_id);
  
  return (
    <div className="p-4 md:p-8 bg-gray-100 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">📦 Inventario</h1>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={() => setShowCategoryModal(true)} className="flex-1 md:flex-none bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-4 py-2 rounded-xl font-bold shadow-sm transition">
            📂 Categorías
          </button>
          <button onClick={() => handleOpenProductModal(null)} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold shadow-lg transition flex justify-center items-center gap-2">
            <span className="text-xl">+</span> Nuevo
          </button>
        </div>
      </div>

      {/* MODAL CATEGORÍAS */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setShowCategoryModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">✕</button>
            <h2 className="text-xl font-bold mb-4 text-gray-800">📂 Gestionar Categorías</h2>
            
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Nombre Nueva Categoría</label>
                <input name="name" value={categoryForm.name} onChange={handleCategoryChange} placeholder="Ej: Computación, Bebidas..." className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" required />
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">¿Es subcategoría de...?</label>
                <select name="parent_id" value={categoryForm.parent_id} onChange={handleCategoryChange} className="w-full p-3 border rounded-lg bg-gray-50">
                  <option value="">-- Ninguna (Es Principal) --</option>
                  {mainCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700">Guardar Categoría</button>
            </form>

            <div className="mt-6 border-t pt-4">
              <h3 className="text-sm font-bold text-gray-500 mb-2">Existentes:</h3>
              <div className="h-40 overflow-y-auto text-sm space-y-1">
                {mainCategories.length === 0 && <p className="text-gray-400 italic">No hay categorías aún.</p>}
                {mainCategories.map(parent => (
                  <div key={parent.id}>
                    <div className="font-bold text-indigo-900">• {parent.name}</div>
                    {categories.filter(c => c.parent_id === parent.id).map(child => (
                      <div key={child.id} className="pl-4 text-gray-600">└ {child.name}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRODUCTO */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-gray-800">{editingProduct ? '✏️ Editar Producto' : '✨ Nuevo Producto'}</h2>
            <form onSubmit={handleSaveProduct} className="space-y-3">
              <input name="name" value={productForm.name} onChange={handleProductChange} placeholder="Nombre del Producto" className="w-full p-3 border rounded-lg" required />
              <div className="grid grid-cols-2 gap-3">
                <input name="barcode" value={productForm.barcode} onChange={handleProductChange} placeholder="Código Barras" className="w-full p-3 border rounded-lg" />
                <select name="category_id" value={productForm.category_id} onChange={handleProductChange} className="w-full p-3 border rounded-lg bg-indigo-50 border-indigo-200">
                  <option value="">-- Sin Categoría --</option>
                  {mainCategories.map(parent => (
                    <optgroup key={parent.id} label={parent.name}>
                      <option value={parent.id}>{parent.name} (General)</option>
                      {categories.filter(c => c.parent_id === parent.id).map(child => (
                        <option key={child.id} value={child.id}>&nbsp;&nbsp;&nbsp;└ {child.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input name="cost_price" type="number" step="0.01" value={productForm.cost_price} onChange={handleProductChange} placeholder="Costo $" className="w-full p-3 border rounded-lg" />
                <input name="price_sell" type="number" step="0.01" value={productForm.price_sell} onChange={handleProductChange} placeholder="Venta $" className="w-full p-3 border border-green-300 font-bold text-green-700" required />
              </div>
              <input name="stock_current" type="number" value={productForm.stock_current} onChange={handleProductChange} placeholder="Stock Inicial" className="w-full p-3 border rounded-lg" required />
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setShowProductModal(false)} className="flex-1 py-3 bg-gray-100 font-bold rounded-lg text-gray-600">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TABLA DE PRODUCTOS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold border-b">Producto</th>
                <th className="p-4 font-bold border-b hidden md:table-cell">Categoría</th>
                <th className="p-4 font-bold border-b hidden md:table-cell">Código</th>
                <th className="p-4 font-bold border-b hidden md:table-cell">Costo</th>
                <th className="p-4 font-bold border-b text-center">Stock</th>
                <th className="p-4 font-bold border-b text-right">Precio</th>
                <th className="p-4 font-bold border-b text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="7" className="p-8 text-center text-gray-500">Cargando inventario...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-gray-400">No hay productos.</td></tr>
              ) : products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition">
                  <td className="p-4">
                    <div className="font-bold text-gray-800">{product.name}</div>
                    <div className="md:hidden text-xs text-indigo-500 font-medium">{product.categories?.name || "Sin categoría"}</div>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    {product.categories ? <span className="bg-indigo-100 text-indigo-700 py-1 px-2 rounded-lg text-xs font-bold">{product.categories.name}</span> : <span className="text-gray-400 text-xs">---</span>}
                  </td>
                  <td className="p-4 text-gray-500 text-sm hidden md:table-cell">{product.barcode || "---"}</td>
                  <td className="p-4 text-gray-500 text-sm hidden md:table-cell">${product.cost_price || 0}</td>
                  <td className="p-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-bold ${product.stock_current < 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{product.stock_current}</span></td>
                  <td className="p-4 font-bold text-indigo-700 text-right">${product.price_sell}</td>
                  <td className="p-4 flex justify-center gap-2">
                    <button onClick={() => handleOpenProductModal(product)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition">✏️</button>
                    <button onClick={() => handleDeleteProduct(product.id, product.name)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;