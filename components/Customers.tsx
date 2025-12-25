import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { logAction } from '../services/audit'; // <--- IMPORTAMOS LOGGER
import { Search, UserPlus, Phone, MapPin, Save, Edit, Trash, X, AlertTriangle } from 'lucide-react';

export default function Clients() {
  const [clients, setClients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado para saber quién soy
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  
  // Estado del formulario
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setCurrentUserEmail(user.email);
    });

    fetchClients();
  }, []);

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
    if (data) setClients(data);
  };

  const handleSave = async () => {
    if (!formData.name) return alert("El nombre es obligatorio");

    // === MODO SIMULACIÓN (DEMO) ===
    if (currentUserEmail.includes('demo')) {
        const fakeId = editingId || `temp-${Date.now()}`;
        const fakeClient = {
            id: fakeId,
            name: formData.name,
            phone: formData.phone,
            address: formData.address,
            created_at: new Date().toISOString()
        };

        if (editingId) {
            setClients(clients.map(c => c.id === editingId ? { ...c, ...fakeClient } : c));
            // LOG DEMO
            logAction('EDITAR_CLIENTE', `(Simulado) Editado: ${formData.name}`, 'Clientes');
        } else {
            setClients([fakeClient, ...clients]);
            // LOG DEMO
            logAction('CREAR_CLIENTE', `(Simulado) Nuevo: ${formData.name}`, 'Clientes');
        }
        
        resetForm();
        alert("✅ Cliente guardado en MEMORIA (Modo Demo).\nNo se guardó en la base de datos real.");
        return; 
    }

    // === MODO REAL (ADMIN) ===
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("Error de sesión");

    let error;

    if (editingId) {
      const { error: updateError } = await supabase
        .from('clients')
        .update({ name: formData.name, phone: formData.phone, address: formData.address })
        .eq('id', editingId);
      error = updateError;
      
      if(!error) await logAction('EDITAR_CLIENTE', `Editado: ${formData.name}`, 'Clientes');

    } else {
      const { error: insertError } = await supabase
        .from('clients')
        .insert([{ 
            name: formData.name, 
            phone: formData.phone, 
            address: formData.address,
            user_id: user.id 
        }]);
      error = insertError;

      if(!error) await logAction('CREAR_CLIENTE', `Nuevo: ${formData.name}`, 'Clientes');
    }

    if (!error) {
      resetForm();
      fetchClients();
    } else {
      alert("Error al guardar: " + error.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Borrar a ${name}?`)) return;

    // === MODO SIMULACIÓN ===
    if (currentUserEmail.includes('demo')) {
        setClients(clients.filter(c => c.id !== id));
        logAction('ELIMINAR_CLIENTE', `(Simulado) Borrado: ${name}`, 'Clientes');
        alert("🗑️ Cliente borrado de MEMORIA (Modo Demo).");
        return;
    }
    
    // === MODO REAL ===
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) {
      alert("No se pudo borrar: " + error.message);
    } else {
      await logAction('ELIMINAR_CLIENTE', `Borrado: ${name}`, 'Clientes');
      fetchClients();
    }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', address: '' });
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleEdit = (client: any) => {
    setFormData({ name: client.name, phone: client.phone || '', address: client.address || '' });
    setEditingId(client.id);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone && c.phone.includes(searchTerm))
  );

  const isDemo = currentUserEmail.includes('demo');

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">👥 Base de Clientes</h2>
        <button 
          onClick={() => { resetForm(); setIsFormOpen(!isFormOpen); }} 
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
        >
          {isFormOpen ? <X size={20} /> : <UserPlus size={20} />} 
          {isFormOpen ? 'Cancelar' : 'Nuevo Cliente'}
        </button>
      </div>

      {isDemo && (
          <div className="mb-6 bg-orange-50 border border-orange-200 p-3 rounded-lg flex items-center gap-3 text-orange-800 text-sm">
              <AlertTriangle size={20} className="text-orange-500"/>
              <p><strong>Modo Demo Activo:</strong> Los clientes que crees aquí no se guardarán en la base de datos real.</p>
          </div>
      )}

      {/* Formulario */}
      {isFormOpen && (
        <div className={`bg-white p-6 rounded-xl mb-8 shadow-md border-l-4 animate-in fade-in slide-in-from-top-4 ${isDemo ? 'border-orange-500' : 'border-blue-500'}`}>
          <h3 className="font-bold mb-4 text-gray-700 flex items-center gap-2">
            {editingId ? <Edit size={18} className={isDemo ? 'text-orange-500' : 'text-blue-500'}/> : <UserPlus size={18} className={isDemo ? 'text-orange-500' : 'text-blue-500'}/>}
            {editingId ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
            {isDemo && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded ml-2">SIMULACIÓN</span>}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nombre Completo</label>
              <input 
                placeholder="Ej: Lionel Messi" 
                className={`w-full p-3 rounded-lg border focus:ring-2 outline-none ${isDemo ? 'border-orange-200 focus:ring-orange-500' : 'border-gray-300 focus:ring-blue-500'}`}
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Teléfono</label>
              <input 
                placeholder="Ej: 11 1234 5678" 
                className={`w-full p-3 rounded-lg border focus:ring-2 outline-none ${isDemo ? 'border-orange-200 focus:ring-orange-500' : 'border-gray-300 focus:ring-blue-500'}`}
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Dirección</label>
              <input 
                placeholder="Ej: Calle Falsa 123" 
                className={`w-full p-3 rounded-lg border focus:ring-2 outline-none ${isDemo ? 'border-orange-200 focus:ring-orange-500' : 'border-gray-300 focus:ring-blue-500'}`}
                value={formData.address} 
                onChange={e => setFormData({...formData, address: e.target.value})} 
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button 
              onClick={handleSave} 
              className={`flex-1 text-white py-2 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors ${isDemo ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              <Save size={18} /> {editingId ? 'Guardar Cambios' : 'Registrar Cliente'}
            </button>
            {editingId && (
              <button onClick={resetForm} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium">
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Buscador y Lista */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Buscar..." 
          className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map(client => (
          <div key={client.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group relative">
            <div className="absolute top-4 right-4 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleEdit(client)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={16} /></button>
              <button onClick={() => handleDelete(client.id, client.name)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash size={16} /></button>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div className="bg-blue-100 text-blue-600 font-bold w-10 h-10 rounded-full flex items-center justify-center">
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg leading-tight">{client.name}</h3>
                <span className="text-xs text-gray-400">Desde {client.created_at ? new Date(client.created_at).toLocaleDateString() : 'Hoy'}</span>
              </div>
            </div>
            
            <div className="space-y-2 mt-4 pt-4 border-t border-gray-50">
              <p className={`flex items-center gap-2 text-sm ${client.phone ? 'text-gray-600' : 'text-gray-300 italic'}`}><Phone size={16} className="text-gray-400"/> {client.phone || 'Sin teléfono'}</p>
              <p className={`flex items-center gap-2 text-sm ${client.address ? 'text-gray-600' : 'text-gray-300 italic'}`}><MapPin size={16} className="text-gray-400"/> {client.address || 'Sin dirección'}</p>
            </div>
          </div>
        ))}
        {filteredClients.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
            <p className="font-medium">No se encontraron clientes.</p>
          </div>
        )}
      </div>
    </div>
  );
}