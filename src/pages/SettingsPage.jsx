import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const SettingsPage = () => {
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState(null); // Guardamos el ID de la empresa
  const [settings, setSettings] = useState({
    name: '',
    address: '',
    phone: '',
    logo_url: '',
    cuit: '', // Nuevo: Documento Fiscal
    legal_name: '', // Nuevo: Razón Social
    tax_category: 'Monotributo' // Nuevo: Categoría fiscal por defecto
  });
  const [uploading, setUploading] = useState(false);

  // 1. Cargar datos existentes al entrar (Vinculados a tu empresa)
  useEffect(() => {
    const fetchSettings = async () => {
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
            // Pedimos los ajustes específicos de TU organización
            const { data } = await supabase
              .from('store_settings')
              .select('*')
              .eq('organization_id', profile.organization_id)
              .single();
              
            if (data) setSettings(data);
          }
        }
      } catch (error) {
        console.error("Error cargando ajustes:", error);
      }
    };
    fetchSettings();
  }, []);

  // 2. Función para subir el LOGO
  const handleLogoUpload = async (event) => {
    try {
      setUploading(true);
      const file = event.target.files[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

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
    if (!orgId) return alert("Error: No se detectó la organización.");
    setLoading(true);

    const updates = {
      organization_id: orgId, // Vinculamos los ajustes a TU empresa
      ...settings,
      updated_at: new Date()
    };

    // Al usar 'upsert', Supabase usará el organization_id para saber si debe actualizar
    // los ajustes de tu empresa o crear unos nuevos si es la primera vez.
    const { error } = await supabase
      .from('store_settings')
      .upsert(updates, { onConflict: 'organization_id' });

    if (error) alert(error.message);
    else {
      alert('¡Configuración guardada!');
      window.location.reload();
    }
    
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

          {/* DATOS COMERCIALES */}
          <h2 className="text-lg font-bold text-gray-800 border-b pb-2">Datos Comerciales</h2>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Nombre de Fantasía (Tienda)</label>
            <input 
              type="text" 
              value={settings.name}
              onChange={(e) => setSettings({...settings, name: e.target.value})}
              placeholder="Ej: Jaimito Store"
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
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
                className="w-full p-3 border border-gray-300 rounded-xl outline-none"
                />
            </div>
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Teléfono</label>
                <input 
                type="text" 
                value={settings.phone}
                onChange={(e) => setSettings({...settings, phone: e.target.value})}
                placeholder="+54 9 11..."
                className="w-full p-3 border border-gray-300 rounded-xl outline-none"
                />
            </div>
          </div>

          {/* DATOS FISCALES (NUEVO) */}
          <h2 className="text-lg font-bold text-gray-800 border-b pb-2 mt-6">Datos Fiscales (Para Recibos)</h2>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Razón Social</label>
            <input 
              type="text" 
              value={settings.legal_name || ''}
              onChange={(e) => setSettings({...settings, legal_name: e.target.value})}
              placeholder="Ej: Juan Pérez o Empresa S.A."
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">CUIT / RUT</label>
                <input 
                type="text" 
                value={settings.cuit || ''}
                onChange={(e) => setSettings({...settings, cuit: e.target.value})}
                placeholder="20-12345678-9"
                className="w-full p-3 border border-gray-300 rounded-xl outline-none"
                />
            </div>
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Categoría Fiscal</label>
                <select 
                  value={settings.tax_category || 'Monotributo'}
                  onChange={(e) => setSettings({...settings, tax_category: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-xl outline-none bg-white"
                >
                  <option value="Monotributo">Monotributo</option>
                  <option value="Responsable Inscripto">Responsable Inscripto</option>
                  <option value="Consumidor Final">Consumidor Final</option>
                  <option value="Exento">Exento</option>
                </select>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition transform active:scale-95 mt-6"
          >
            {loading ? 'Guardando...' : '💾 Guardar Cambios'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;