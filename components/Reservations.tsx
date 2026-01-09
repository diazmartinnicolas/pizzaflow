import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { 
  CalendarClock, Plus, Search, Trash2, X, 
  Save, Users, Phone, MessageCircle, Check, Calendar 
} from 'lucide-react';
import { getReservationLink } from '../utils/whatsapp';

export default function Reservations() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Formulario
  const [formData, setFormData] = useState({
    client_name: '',
    phone: '', 
    date: new Date().toISOString().split('T')[0], // Hoy
    time: '21:00',
    pax: 2,
    notes: ''
  });

  useEffect(() => {
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true });
        
      if (error) throw error;
      if (data) setReservations(data);
    } catch (error) {
      console.error("Error cargando reservas:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.client_name) return alert("Falta el nombre del cliente");
    // Nota: El teléfono es opcional para guardar, pero necesario para WhatsApp
    
    try {
      const { data, error } = await supabase
        .from('reservations')
        .insert([{
            client_name: formData.client_name,
            phone: formData.phone,
            date: formData.date,
            time: formData.time,
            pax: formData.pax,
            notes: formData.notes,
            status: 'pendiente'
        }])
        .select()
        .single();

      if (error) throw error;

      setReservations(prev => [...prev, data]);
      setIsModalOpen(false);
      
      setFormData({
        client_name: '',
        phone: '',
        date: new Date().toISOString().split('T')[0],
        time: '21:00',
        pax: 2,
        notes: ''
      });

    } catch (error: any) {
      alert("Error guardando: " + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Borrar esta reserva?")) return;

    // OPTIMISTIC UI
    setReservations(prev => prev.filter(r => r.id !== id));

    try {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      alert("Error borrando: " + error.message);
      fetchReservations(); 
    }
  };

  const handleConfirmWhatsApp = (reservation: any) => {
    if (!reservation.phone) return alert("No hay teléfono cargado.");

    const link = getReservationLink({
        customerName: reservation.client_name || 'Cliente', // Protección extra
        date: reservation.date,
        time: reservation.time,
        pax: reservation.pax,
        phone: reservation.phone
    });

    window.location.href = link;
  };

  const handleMarkReady = async (id: string) => {
      setReservations(prev => prev.map(r => r.id === id ? {...r, status: 'confirmada'} : r));
      await supabase.from('reservations').update({ status: 'confirmada' }).eq('id', id);
  };

  // 👇 AQUÍ ESTABA EL ERROR. AHORA ESTÁ BLINDADO 🛡️
  const filtered = reservations.filter(r => {
    // Si r.client_name es null, usamos '' (texto vacío) para que no explote
    const name = r.client_name || ''; 
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="p-6 h-full flex flex-col bg-gray-50">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <CalendarClock size={32} className="text-purple-600" /> Reservas
        </h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 font-bold">
          <Plus size={20}/> Nueva Reserva
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
                type="text" 
                placeholder="Buscar reserva..." 
                className="w-full pl-10 p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white rounded-xl shadow-sm border border-gray-200">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-500 font-bold text-xs uppercase tracking-wider sticky top-0 z-10">
            <tr>
              <th className="p-4 border-b">Cliente</th>
              <th className="p-4 border-b">Fecha y Hora</th>
              <th className="p-4 border-b">Personas</th>
              <th className="p-4 border-b text-center">Estado</th>
              <th className="p-4 border-b text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Sin reservas.</td></tr>
            ) : (
                filtered.map(res => (
                    <tr key={res.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="p-4">
                            {/* Protección extra visual por si no hay nombre */}
                            <div className="font-bold text-gray-800">{res.client_name || 'Sin Nombre'}</div>
                            {res.phone && <div className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10}/> {res.phone}</div>}
                            {res.notes && <div className="text-xs text-orange-500 italic mt-1">"{res.notes}"</div>}
                        </td>
                        <td className="p-4">
                            <div className="text-sm font-medium">{new Date(res.date).toLocaleDateString()}</div>
                            <div className="text-xs text-gray-500">{res.time} hs</div>
                        </td>
                        <td className="p-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Users size={16}/> {res.pax}
                            </div>
                        </td>
                        <td className="p-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${res.status === 'confirmada' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {res.status || 'Pendiente'}
                            </span>
                        </td>
                        <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                                <button 
                                    onClick={() => handleConfirmWhatsApp(res)}
                                    className="p-2 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-lg transition-colors border border-green-200"
                                    title="Confirmar por WhatsApp"
                                >
                                    <MessageCircle size={18}/>
                                </button>
                                
                                {res.status !== 'confirmada' && (
                                    <button onClick={() => handleMarkReady(res.id)} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg">
                                        <Check size={18}/>
                                    </button>
                                )}
                                
                                <button onClick={() => handleDelete(res.id)} className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                    <Trash2 size={18}/>
                                </button>
                            </div>
                        </td>
                    </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800">Nueva Reserva</h3>
                    <button onClick={() => setIsModalOpen(false)}><X size={20}/></button>
                </div>
                <div className="p-5 space-y-3">
                    <input autoFocus className="w-full p-3 border rounded-lg text-sm" placeholder="Nombre Cliente" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} />
                    
                    <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                        <input className="w-full pl-10 p-3 border rounded-lg text-sm" placeholder="Teléfono (ej: 1122334455)" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                            <input type="date" className="w-full pl-10 p-3 border rounded-lg text-sm" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                        </div>
                        <input type="time" className="w-full p-3 border rounded-lg text-sm" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
                    </div>

                    <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg border">
                        <Users size={18} className="text-gray-500 ml-2"/>
                        <span className="text-sm font-medium">Personas:</span>
                        <input type="number" min="1" className="w-16 p-1 border rounded text-center" value={formData.pax} onChange={e => setFormData({...formData, pax: Number(e.target.value)})} />
                    </div>

                    <textarea className="w-full p-3 border rounded-lg text-sm h-20 resize-none" placeholder="Notas (cumpleaños, sillita...)" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />

                    <button onClick={handleSave} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl shadow-lg mt-2">
                        Guardar Reserva
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}