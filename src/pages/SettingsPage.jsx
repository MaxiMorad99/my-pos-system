import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const SettingsPage = () => {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    name: '',
    address: '',
    phone: '',
    logo_url: ''
  });
  const [uploading, setUploading] = useState(false);

  // 1. Cargar datos existentes al entrar
  useEffect(() => {
    const fetchSettings = async () => {
      // Pedimos el primer registro (solo habrá uno por tienda)
      const { data } = await supabase.from('store_settings').select('*').single();
      if (data) setSettings(data);
    };
    fetchSettings();
  }, []);

  // 2. Función para subir el LOGO
  const handleLogoUpload = async (event) => {
    try {
      setUploading(true);
      const file = event.target.files[0];
      if (!file) return;

      // Creamos un nombre único para el archivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Subimos a Supabase Storage (bucket 'logos')
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obtenemos la URL pública para mostrarla
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      setSettings({ ...settings, logo_url: publicUrl });
    } catch (error) {
      alert('Error subiendo imagen: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // 3. Guardar todo en la Base de Datos
  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Usamos 'upsert': Si existe lo actualiza, si no, lo crea.
    // Usamos id: 1 para asegurar que siempre sea la misma configuración principal.
    const updates = {
      id: 1, 
      ...settings,
      updated_at: new Date()
    };

    const { error } = await supabase.from('store_settings').upsert(updates);

    if (error) alert(error.message);
    else alert('¡Configuración guardada!');
    
// ✨ TRUCO MÁGICO: Recargar la página para actualizar la barra de arriba ✨
      window.location.reload();

    setLoading(false);
  };

  return (
    <div className="p-8 bg-gray-100 min-h-screen flex justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">⚙️ Configuración de la Tienda</h1>
        
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* SECCIÓN LOGO */}
          <div className="flex items-center gap-6">
            <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden border-4 border-white shadow-md">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl">🏪</span>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Logo del Negocio</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploading}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-indigo-50 file:text-indigo-700
                  hover:file:bg-indigo-100"
              />
              {uploading && <p className="text-xs text-blue-500 mt-1">Subiendo...</p>}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* DATOS DE TEXTO */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Nombre de la Tienda</label>
            <input 
              type="text" 
              value={settings.name}
              onChange={(e) => setSettings({...settings, name: e.target.value})}
              placeholder="Ej: Mi Supermercado"
              className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Dirección</label>
                <input 
                type="text" 
                value={settings.address}
                onChange={(e) => setSettings({...settings, address: e.target.value})}
                placeholder="Calle Falsa 123"
                className="w-full p-4 border border-gray-300 rounded-xl outline-none"
                />
            </div>
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Teléfono</label>
                <input 
                type="text" 
                value={settings.phone}
                onChange={(e) => setSettings({...settings, phone: e.target.value})}
                placeholder="+54 9 11..."
                className="w-full p-4 border border-gray-300 rounded-xl outline-none"
                />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition transform active:scale-95"
          >
            {loading ? 'Guardando...' : '💾 Guardar Cambios'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;