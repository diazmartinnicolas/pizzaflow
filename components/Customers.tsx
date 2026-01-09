import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { logAction } from '../services/audit';
import { 
  Users, Search, Plus, Trash2, Edit, X, 
  Save, MapPin, Phone, UserCheck, RefreshCw, 
  Gift, CalendarHeart, Settings, ToggleLeft, ToggleRight, CheckCircle, ArrowRight
} from 'lucide-react';
import { getBirthdayLink } from '../utils/whatsapp';

export default function Customers() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  
  // Estado para controlar a quién ya le enviamos saludo en esta sesión
  const [sentBirthdays, setSentBirthdays] = useState<string[]>([]);

  // Configuración de Cumpleaños
  const [birthdayConfig, setBirthdayConfig] = useState(() => {
      const saved = localStorage.getItem('fluxo_birthday_config');
      return saved ? JSON.parse(saved) : { enabled: true, giftText: '20% OFF en tu pedido' };
  });

  useEffect(() => {
      localStorage.setItem('fluxo_birthday_config', JSON.stringify(birthdayConfig));
  }, [birthdayConfig]);
  
  // Formulario
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    birth_date: '' 
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('is_active', true)
        .order('name');
        
      if (error) throw error;
      if (data) setClients(data);
    } catch (error) {
      console.error("Error cargando clientes:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLERS BÁSICOS ---
  const handleOpenCreate = () => {
    setEditingClient(null);
    setFormData({ name: '', address: '', phone: '', birth_date: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (client: any) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      address: client.address || '',
      phone: client.phone || '',
      birth_date: client.birth_date || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return alert("El nombre es obligatorio.");

    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("No usuario");

      const payload = { ...formData, birth_date: formData.birth_date || null };

      if (editingClient) {
        const { error } = await supabase.from('clients').update(payload).eq('id', editingClient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clients').insert([{ ...payload, user_id: user.id }]);
        if (error) throw error;
      }

      fetchClients();
      setIsModalOpen(false);
    } catch (error: any) {
      alert("Error: " + error.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar cliente "${name}"?`)) return;
    try {
      await supabase.from('clients').update({ is_active: false }).eq('id', id);
      fetchClients(); 
    } catch (error: any) { alert("Error: " + error.message); }
  };

  // --- LÓGICA DE CUMPLEAÑOS INTELIGENTE 🧠 ---
  
  const getTodaysBirthdays = () => {
      const today = new Date();
      const currentDay = today.getDate();
      const currentMonth = today.getMonth() + 1;

      return clients.filter(c => {
          if (!c.birth_date) return false;
          const parts = c.birth_date.split('-'); 
          return parseInt(parts[2]) === currentDay && parseInt(parts[1]) === currentMonth;
      });
  };

  const birthdayPeople = getTodaysBirthdays();

  // Encontramos el PRIMER cumpleañero al que NO le hayamos enviado mensaje aún
  const nextToGreet = birthdayPeople.find(p => !sentBirthdays.includes(p.id));
  const remainingCount = birthdayPeople.filter(p => !sentBirthdays.includes(p.id)).length;
  const isAllSent = birthdayPeople.length > 0 && remainingCount === 0;

  const handleSendNextGift = () => {
      if (!nextToGreet) return;

      if (!nextToGreet.phone) {
          alert(`El cliente ${nextToGreet.name} no tiene teléfono. Saltando al siguiente...`);
          setSentBirthdays(prev => [...prev, nextToGreet.id]);
          return;
      }
      
      const link = getBirthdayLink({
          customerName: nextToGreet.name,
          phone: nextToGreet.phone,
          discountText: birthdayConfig.giftText
      });

      // Marcamos como enviado
      setSentBirthdays(prev => [...prev, nextToGreet.id]);

      // Abrimos WhatsApp
      window.location.href = link;
  };

  // --- FILTRADO ---
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.phone && c.phone.includes(searchTerm))
  );

  return (
    <div className="p-6 h-full flex flex-col bg-gray-50">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <Users size={32} className="text-orange-600" /> Cartera de Clientes
          </h2>
          <p className="text-sm text-gray-500 mt-1">Administra tus clientes y promociones.</p>
        </div>
        
        <div className="flex gap-3">
            <button 
                onClick={() => setIsConfigOpen(true)}
                className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 font-bold transition-colors"
                title="Configurar Regalos"
            >
                <Settings size={20}/>
            </button>

            <button 
                onClick={handleOpenCreate} 
                className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 font-bold transition-colors"
            >
                <Plus size={20}/> Nuevo Cliente
            </button>
        </div>
      </div>

      {/* 🎂 PANEL UNIFICADO DE CUMPLEAÑOS */}
      {birthdayConfig.enabled && birthdayPeople.length > 0 && (
          <div className="bg-gradient-to-r from-pink-600 to-purple-700 rounded-2xl p-6 mb-6 text-white shadow-xl animate-in fade-in slide-in-from-top-4 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
              
              {/* Decoración Fondo */}
              <div className="absolute -right-10 -top-10 opacity-10 rotate-12 pointer-events-none">
                  <Gift size={200} />
              </div>

              {/* Lado Izquierdo: Info */}
              <div className="z-10 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                        <Gift size={28} className="text-white" />
                    </div>
                    <h3 className="font-bold text-2xl">¡Hoy hay {birthdayPeople.length} Cumpleaños!</h3>
                  </div>
                  <p className="text-pink-100 mb-4 opacity-90">
                      Regalo configurado: <strong className="bg-black/20 px-2 py-0.5 rounded text-white">{birthdayConfig.giftText}</strong>
                  </p>
                  
                  {/* Lista pequeña de nombres */}
                  <div className="flex flex-wrap gap-2">
                      {birthdayPeople.map(p => (
                          <span key={p.id} className={`text-xs px-2 py-1 rounded-full border ${sentBirthdays.includes(p.id) ? 'bg-green-500/20 border-green-400/50 text-green-100 line-through' : 'bg-white/10 border-white/20 text-white'}`}>
                              {p.name}
                          </span>
                      ))}
                  </div>
              </div>
              
              {/* Lado Derecho: EL BOTÓN ÚNICO DE ACCIÓN */}
              <div className="z-10 flex-shrink-0 w-full md:w-auto">
                  {isAllSent ? (
                      <div className="bg-green-500 text-white px-6 py-4 rounded-xl font-bold flex items-center gap-3 shadow-lg animate-in zoom-in">
                          <CheckCircle size={24} />
                          <span>¡Todos saludados!</span>
                      </div>
                  ) : (
                      <button 
                        onClick={handleSendNextGift}
                        className="w-full md:w-auto bg-white text-purple-700 hover:bg-pink-50 px-6 py-4 rounded-xl font-bold text-lg shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
                      >
                          <Gift size={24} className="text-purple-600"/>
                          <div className="flex flex-col items-start leading-tight">
                              <span>Enviar a {nextToGreet?.name.split(' ')[0]}</span>
                              <span className="text-xs text-purple-400 font-normal">
                                  ({birthdayPeople.length - remainingCount + 1} de {birthdayPeople.length}) - Clic para abrir WhatsApp
                              </span>
                          </div>
                          <ArrowRight size={20} className="text-purple-400"/>
                      </button>
                  )}
              </div>
          </div>
      )}

      {/* BARRA DE BÚSQUEDA */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex items-center gap-4">
        <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={18} /></div>
            <input 
                type="text" 
                placeholder="Buscar por nombre o teléfono..." 
                className="w-full pl-10 p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {/* TABLA DE CLIENTES */}
      <div className="flex-1 overflow-auto bg-white rounded-xl shadow-sm border border-gray-200">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-500 font-bold text-xs uppercase tracking-wider sticky top-0 z-10">
            <tr>
              <th className="p-4 border-b pl-6">Nombre</th>
              <th className="p-4 border-b">Dirección</th>
              <th className="p-4 border-b">Teléfono</th>
              <th className="p-4 border-b">Cumpleaños</th>
              <th className="p-4 border-b text-right pr-6">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Cargando...</td></tr>
            ) : filteredClients.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">No se encontraron clientes.</td></tr>
            ) : (
                filteredClients.map(client => (
                    <tr key={client.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="p-4 pl-6 font-bold text-gray-800">{client.name}</td>
                        <td className="p-4 text-gray-600 text-sm">{client.address || '-'}</td>
                        <td className="p-4 text-gray-600 text-sm">{client.phone || '-'}</td>
                        <td className="p-4 text-gray-600">
                            {client.birth_date ? (
                                <span className="flex items-center gap-2 text-sm">
                                    <CalendarHeart size={14} className="text-pink-400"/> 
                                    {client.birth_date.split('-')[2]}/{client.birth_date.split('-')[1]}
                                </span>
                            ) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="p-4 text-right pr-6">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleOpenEdit(client)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={18}/></button>
                                <button onClick={() => handleDelete(client.id, client.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                            </div>
                        </td>
                    </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL CONFIG ⚙️ */}
      {isConfigOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="bg-purple-50 p-4 border-b border-purple-100 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-purple-800 flex items-center gap-2"><Gift size={20}/> Configurar Regalos</h3>
                    <button onClick={() => setIsConfigOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-700">Activar Avisos</span>
                        <button onClick={() => setBirthdayConfig(p => ({ ...p, enabled: !p.enabled }))} className={birthdayConfig.enabled ? 'text-green-500' : 'text-gray-400'}>
                            {birthdayConfig.enabled ? <ToggleRight size={40}/> : <ToggleLeft size={40}/>}
                        </button>
                    </div>
                    <div className={!birthdayConfig.enabled ? 'opacity-50 pointer-events-none' : ''}>
                        <label className="block text-sm font-bold text-gray-700 mb-2">¿Qué regalamos hoy?</label>
                        <input type="text" className="w-full p-3 border-2 border-purple-100 rounded-xl focus:border-purple-500 outline-none text-purple-900 font-medium"
                            value={birthdayConfig.giftText} onChange={(e) => setBirthdayConfig(p => ({ ...p, giftText: e.target.value }))}
                        />
                    </div>
                    <button onClick={() => setIsConfigOpen(false)} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl shadow-lg">Guardar Cambios</button>
                </div>
             </div>
        </div>
      )}

      {/* MODAL CREAR/EDITAR (Simplificado para el ejemplo) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800">{editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                    <button onClick={() => setIsModalOpen(false)}><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4">
                    <input autoFocus placeholder="Nombre" className="w-full p-3 border rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}/>
                    <input placeholder="Dirección" className="w-full p-3 border rounded-lg" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})}/>
                    <div className="grid grid-cols-2 gap-4">
                        <input placeholder="Teléfono" className="w-full p-3 border rounded-lg" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}/>
                        <input type="date" className="w-full p-3 border rounded-lg" value={formData.birth_date} onChange={e => setFormData({...formData, birth_date: e.target.value})}/>
                    </div>
                    <button onClick={handleSave} className="w-full mt-4 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3.5 rounded-xl">Guardar Cliente</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}