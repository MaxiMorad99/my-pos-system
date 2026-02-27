import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const SettingsPage = () => {
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState(null); 
  
  // Estado para Configuración Principal
  const [settings, setSettings] = useState({
    name: '',
    address: '',
    phone: '',
    logo_url: '',
    cuit: '', 
    legal_name: '', 
    tax_category: 'Monotributo' 
  });
  const [uploading, setUploading] = useState(false);

  // Estados para Gestión de Cajas
  const [registers, setRegisters] = useState([]);
  const [newRegisterName, setNewRegisterName] = useState('');
  const [newRegisterPrefix, setNewRegisterPrefix] = useState('');

  // 1. Cargar datos al entrar
  useEffect(() => {
    const initSettings = async () => {
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
            
            // Cargar Ajustes de Tienda
            const { data: storeData } = await supabase
              .from('store_settings')
              .select('*')
              .eq('organization_id', profile.organization_id)
              .single();
            if (storeData) setSettings(storeData);

            // Cargar Cajas
            fetchRegisters(profile.organization_id);
          }
        }
      } catch (error) {
        console.error("Error cargando ajustes:", error);
      }
    };
    initSettings();
  }, []);

  const fetchRegisters = async (organizationId) => {
    const { data } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('organization_id', organizationId)
      .order('prefix', { ascending: true });
    
    if (data) setRegisters(data);
  };

  // 2. Función para subir el LOGO
  const handleLogoUpload = async (event) => {
    try {
      setUploading(true);
      const file = event.target.files[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(filePath);
      setSettings({ ...settings, logo_url: publicUrl });
    } catch (error) {
      alert('Error subiendo imagen: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // 3. Guardar Ajustes Principales
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!orgId) return alert("Error: No se detectó la organización.");
    setLoading(true);

    const updates = {
      organization_id: orgId,
      ...settings,
      updated_at: new Date()
    };

    const { error } = await supabase.from('store_settings').upsert(updates, { onConflict: 'organization_id' });

    if (error) {
      alert(error.message);
    } else {
      alert('¡Configuración guardada!');
      window.location.reload();
    }
    setLoading(false);
  };

  // 4. Agregar Nueva Caja
  const handleAddRegister = async (e) => {
    e.preventDefault();
    if (!orgId) return alert("Error de sesión.");
    if (!newRegisterName || !newRegisterPrefix) return alert("Completa nombre y prefijo de la caja.");

    // Validar longitud del prefijo (idealmente 4 dígitos)
    const formattedPrefix = newRegisterPrefix.padStart(4, '0').slice(0, 4);

    // Verificar que no exista el mismo prefijo
    const exists = registers.find(r => r.prefix === formattedPrefix);
    if (exists) return alert(`El prefijo ${formattedPrefix} ya está siendo usado por otra caja.`);

    try {
      const { error } = await supabase.from('cash_registers').insert([{
        name: newRegisterName,
        prefix: formattedPrefix,
        organization_id: orgId
      }]);

      if (error) throw error;

      setNewRegisterName('');
      setNewRegisterPrefix('');
      fetchRegisters(orgId); // Recargar la lista
      alert("Caja agregada correctamente.");
    } catch (error) {
      alert("Error al agregar caja: " + error.message);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gray-100 min-h-screen flex flex-col items-center gap-8">
      
      {/* PANEL 1: CONFIGURACIÓN DE LA TIENDA */}
      <div className="bg-white p-8 rounded-2xl shadow-sm w-full max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">⚙️ Configuración de la Tienda</h1>
        
        <form onSubmit={handleSaveSettings} className="space-y-6">
          
          <div className="flex items-center gap-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center overflow-hidden border border-gray-200 shadow-inner">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-3xl">🏪</span>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">Logo del Negocio</label>
              <input 
                type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {uploading && <p className="text-xs text-blue-500 mt-1">Subiendo...</p>}
            </div>
          </div>

          <h2 className="text-lg font-bold text-gray-800 border-b pb-2">Datos Comerciales</h2>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Nombre de Fantasía (Tienda)</label>
            <input type="text" value={settings.name} onChange={(e) => setSettings({...settings, name: e.target.value})} placeholder="Ej: Jaimito Store" className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Dirección</label>
                <input type="text" value={settings.address} onChange={(e) => setSettings({...settings, address: e.target.value})} placeholder="Calle Falsa 123" className="w-full p-3 border border-gray-300 rounded-xl outline-none" />
            </div>
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Teléfono</label>
                <input type="text" value={settings.phone} onChange={(e) => setSettings({...settings, phone: e.target.value})} placeholder="+54 9 11..." className="w-full p-3 border border-gray-300 rounded-xl outline-none" />
            </div>
          </div>

          <h2 className="text-lg font-bold text-gray-800 border-b pb-2 mt-6">Datos Fiscales (Para Recibos)</h2>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Razón Social</label>
            <input type="text" value={settings.legal_name || ''} onChange={(e) => setSettings({...settings, legal_name: e.target.value})} placeholder="Ej: Juan Pérez o Empresa S.A." className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">CUIT / RUT</label>
                <input type="text" value={settings.cuit || ''} onChange={(e) => setSettings({...settings, cuit: e.target.value})} placeholder="20-12345678-9" className="w-full p-3 border border-gray-300 rounded-xl outline-none" />
            </div>
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Categoría Fiscal</label>
                <select value={settings.tax_category || 'Monotributo'} onChange={(e) => setSettings({...settings, tax_category: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl outline-none bg-white">
                  <option value="Monotributo">Monotributo</option>
                  <option value="Responsable Inscripto">Responsable Inscripto</option>
                  <option value="Consumidor Final">Consumidor Final</option>
                  <option value="Exento">Exento</option>
                </select>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition transform active:scale-95 mt-4">
            {loading ? 'Guardando...' : '💾 Guardar Ajustes'}
          </button>
        </form>
      </div>

      {/* PANEL 2: GESTIÓN DE CAJAS */}
      <div className="bg-white p-8 rounded-2xl shadow-sm w-full max-w-3xl">
        <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">🏧 Gestión de Terminales (Cajas)</h2>
        
        {/* Lista de cajas actuales */}
        <div className="mb-6 space-y-3">
          <h3 className="text-sm font-bold text-gray-500 uppercase">Cajas Habilitadas</h3>
          {registers.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No hay cajas registradas.</p>
          ) : (
            registers.map(reg => (
              <div key={reg.id} className="flex justify-between items-center p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <div>
                  <div className="font-bold text-indigo-800">{reg.name}</div>
                  <div className="text-xs text-gray-500">ID Base de datos: {reg.id.substring(0, 8)}...</div>
                </div>
                <div className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg font-bold text-sm shadow-inner">
                  Prefijo: {reg.prefix}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Formulario para agregar nueva caja */}
        <form onSubmit={handleAddRegister} className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-indigo-800 mb-1">Nombre de la nueva caja</label>
            <input 
              type="text" 
              placeholder="Ej: Caja 02" 
              value={newRegisterName}
              onChange={(e) => setNewRegisterName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-indigo-500"
            />
          </div>
          <div className="w-full md:w-32">
            <label className="block text-xs font-bold text-indigo-800 mb-1">Prefijo (4 dígitos)</label>
            <input 
              type="text" 
              placeholder="Ej: 0002" 
              maxLength={4}
              value={newRegisterPrefix}
              onChange={(e) => setNewRegisterPrefix(e.target.value.replace(/\D/g, ''))} // Solo números
              className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-indigo-500 font-mono text-center"
            />
          </div>
          <button type="submit" className="w-full md:w-auto px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow transition">
            + Agregar Caja
          </button>
        </form>
        <p className="text-[10px] text-gray-400 mt-2 text-center">Nota: El prefijo definirá el número inicial en tus tickets (Ej: 0002-000000001).</p>
      </div>

    </div>
  );
};

export default SettingsPage;
