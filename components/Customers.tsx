import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Search, UserPlus, Phone, MapPin, Save, Edit, Trash, X } from 'lucide-react';

export default function Clients() {
  const [clients, setClients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado del formulario
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // Si tiene valor, estamos editando
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
    if (data) setClients(data);
  };

  // Función INTELIGENTE: Sirve tanto para Crear como para Editar
  const handleSave = async () => {
    if (!formData.name) return alert("El nombre es obligatorio");
    
    let error;

    if (editingId) {
      // MODO EDICIÓN: Actualizamos el existente
      const { error: updateError } = await supabase
        .from('clients')
        .update({ name: formData.name, phone: formData.phone, address: formData.address })
        .eq('id', editingId);
      error = updateError;
    } else {
      // MODO CREACIÓN: Insertamos uno nuevo
      const { error: insertError } = await supabase
        .from('clients')
        .insert([{ name: formData.name, phone: formData.phone, address: formData.address }]);
      error = insertError;
    }

    if (!error) {
      resetForm();
      fetchClients();
    } else {
      alert("Error al guardar: " + error.message);
    }
  };

  const handleEdit = (client: any) => {
    setFormData({ name: client.name, phone: client.phone || '', address: client.address || '' });
    setEditingId(client.id);
    setIsFormOpen(true);
    // Hacemos scroll suave hacia arriba para ver el formulario
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de borrar este cliente? Se perderá su historial.")) return;
    
    const { error } = await supabase.from('clients').delete().eq('id', id);
    
    if (error) {
      alert("No se pudo borrar: " + error.message);
    } else {
      fetchClients();
    }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', address: '' });
    setEditingId(null);
    setIsFormOpen(false);
  };

  // Filtrar clientes
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone && c.phone.includes(searchTerm))
  );

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

      {/* Formulario (Crear / Editar) */}
      {isFormOpen && (
        <div className="bg-white p-6 rounded-xl mb-8 shadow-md border-l-4 border-blue-500 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-bold mb-4 text-gray-700 flex items-center gap-2">
            {editingId ? <Edit size={18} className="text-blue-500"/> : <UserPlus size={18} className="text-blue-500"/>}
            {editingId ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nombre Completo</label>
              <input 
                placeholder="Ej: Lionel Messi" 
                className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Teléfono / Celular</label>
              <input 
                placeholder="Ej: 11 1234 5678" 
                className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" 
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})} 
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Dirección</label>
              <input 
                placeholder="Ej: Calle Falsa 123" 
                className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" 
                value={formData.address} 
                onChange={e => setFormData({...formData, address: e.target.value})} 
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button 
              onClick={handleSave} 
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 flex justify-center items-center gap-2 transition-colors"
            >
              <Save size={18} /> {editingId ? 'Guardar Cambios' : 'Registrar Cliente'}
            </button>
            {editingId && (
              <button onClick={resetForm} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium">
                Cancelar Edición
              </button>
            )}
          </div>
        </div>
      )}

      {/* Buscador */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por nombre, apellido o teléfono..." 
          className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Lista de Tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map(client => (
          <div key={client.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group relative">
            
            {/* Botones de Acción (Aparecen al pasar el mouse o siempre visibles en móvil) */}
            <div className="absolute top-4 right-4 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => handleEdit(client)} 
                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" 
                title="Editar"
              >
                <Edit size={16} />
              </button>
              <button 
                onClick={() => handleDelete(client.id)} 
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" 
                title="Borrar"
              >
                <Trash size={16} />
              </button>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div className="bg-blue-100 text-blue-600 font-bold w-10 h-10 rounded-full flex items-center justify-center">
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg leading-tight">{client.name}</h3>
                <span className="text-xs text-gray-400">Cliente desde {new Date(client.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            
            <div className="space-y-2 mt-4 pt-4 border-t border-gray-50">
              {client.phone ? (
                <p className="text-gray-600 flex items-center gap-2 text-sm">
                  <Phone size={16} className="text-gray-400"/> {client.phone}
                </p>
              ) : (
                <p className="text-gray-300 flex items-center gap-2 text-sm italic"><Phone size={16}/> Sin teléfono</p>
              )}
              
              {client.address ? (
                <p className="text-gray-600 flex items-center gap-2 text-sm">
                  <MapPin size={16} className="text-gray-400"/> {client.address}
                </p>
              ) : (
                <p className="text-gray-300 flex items-center gap-2 text-sm italic"><MapPin size={16}/> Sin dirección</p>
              )}
            </div>
          </div>
        ))}
        
        {filteredClients.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
            <p className="font-medium">No se encontraron clientes.</p>
            <p className="text-sm mt-1">Intenta con otro nombre o agrega uno nuevo.</p>
          </div>
        )}
      </div>
    </div>
  );
}