import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { logAction } from '../services/audit'; 
import { Calendar, Clock, Users, Plus, X, Check, Search, Trash, Edit, AlertTriangle, Lock, MessageSquare } from 'lucide-react';

export default function Reservations() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Formulario Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '', // CAMBIO: Ahora usamos 'name' para coincidir con la BD
    date: new Date().toISOString().split('T')[0], 
    time: '21:00',
    people: 2,
    notes: ''
  });

  useEffect(() => {
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email || '';

    // === MODO SIMULACIÓN (DEMO) ===
    if (email.toLowerCase().includes('demo')) {
        setIsDemo(true);
        setReservations([
            { id: 'fake-1', name: 'Familia Gómez (Demo)', date: '2024-12-25', time: '21:00', people: 4, status: 'confirmada', notes: 'Mesa cerca de la ventana' },
            { id: 'fake-2', name: 'Pareja Aniversario (Demo)', date: '2024-12-26', time: '20:30', people: 2, status: 'pendiente', notes: 'Traen torta' },
            { id: 'fake-3', name: 'Grupo Trabajo (Demo)', date: '2024-12-27', time: '13:00', people: 10, status: 'cancelada', notes: '' }
        ]);
        setLoading(false);
        return;
    }

    // === MODO REAL (ADMIN) ===
    setIsDemo(false);
    const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true });

    if (error) console.error(error);
    else setReservations(data || []);
    
    setLoading(false);
  };

  const handleSave = async () => {
      if (!formData.name || !formData.date || !formData.time) return alert("Completa los datos principales.");

      // LÓGICA DEMO
      if (isDemo) {
          if (editingId) {
              setReservations(reservations.map(r => r.id === editingId ? { ...r, ...formData } : r));
              logAction('EDITAR_RESERVA', `(Simulado) ${formData.name}`, 'Reservas');
          } else {
              const newRes = { id: `fake-${Date.now()}`, ...formData, status: 'pendiente' };
              setReservations([...reservations, newRes]);
              logAction('CREAR_RESERVA', `(Simulado) ${formData.name} (${formData.people}p)`, 'Reservas');
          }
          closeForm();
          alert("Reserva guardada en MEMORIA (Modo Demo).");
          return;
      }

      // LÓGICA REAL
      const { data: { user } } = await supabase.auth.getUser();
      
      if (editingId) {
          // Editar
          const { error } = await supabase
              .from('reservations')
              .update({ 
                  name: formData.name, // Usamos 'name'
                  date: formData.date,
                  time: formData.time,
                  people: formData.people,
                  notes: formData.notes
              })
              .eq('id', editingId);

          if (!error) {
              await logAction('EDITAR_RESERVA', `Editado: ${formData.name}`, 'Reservas');
              fetchReservations();
              closeForm();
          } else {
              alert("Error: " + error.message);
          }
      } else {
          // Crear
          const { error } = await supabase
              .from('reservations')
              .insert([{ 
                  ...formData, 
                  user_id: user?.id,
                  status: 'pendiente'
              }]);

          if (!error) {
              await logAction('CREAR_RESERVA', `Nueva: ${formData.name} (${formData.people}p)`, 'Reservas');
              fetchReservations();
              closeForm();
          } else {
              alert("Error: " + error.message);
          }
      }
  };

  const handleDelete = async (id: string, name: string) => {
      if(!confirm("¿Borrar esta reserva?")) return;

      if (isDemo) {
          setReservations(reservations.filter(r => r.id !== id));
          logAction('ELIMINAR_RESERVA', `(Simulado) ${name}`, 'Reservas');
          return;
      }

      const { error } = await supabase.from('reservations').delete().eq('id', id);
      if (!error) {
          await logAction('ELIMINAR_RESERVA', `Borrada: ${name}`, 'Reservas');
          fetchReservations();
      } else {
          alert("Error: " + error.message);
      }
  };

  const handleStatusChange = async (id: string, newStatus: string, clientName: string) => {
      if (isDemo) {
          setReservations(reservations.map(r => r.id === id ? { ...r, status: newStatus } : r));
          logAction('ESTADO_RESERVA', `(Simulado) ${clientName} -> ${newStatus.toUpperCase()}`, 'Reservas');
          return;
      }

      const { error } = await supabase.from('reservations').update({ status: newStatus }).eq('id', id);
      if (!error) {
          await logAction('ESTADO_RESERVA', `${clientName} -> ${newStatus.toUpperCase()}`, 'Reservas');
          fetchReservations();
      }
  };

  const openForm = (res?: any) => {
      if (res) {
          setEditingId(res.id);
          setFormData({ name: res.name, date: res.date, time: res.time, people: res.people, notes: res.notes || '' });
      } else {
          setEditingId(null);
          setFormData({ name: '', date: new Date().toISOString().split('T')[0], time: '21:00', people: 2, notes: '' });
      }
      setIsFormOpen(true);
  };

  const closeForm = () => {
      setIsFormOpen(false);
      setEditingId(null);
  };

  const filteredReservations = reservations.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'confirmada': return 'bg-green-100 text-green-700 border-green-200';
          case 'cancelada': return 'bg-red-100 text-red-700 border-red-200';
          default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando libro de reservas...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Calendar className="text-pink-600"/> Reservas
        </h2>
        <button onClick={() => openForm()} className="bg-pink-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-pink-700 transition-colors shadow-sm">
            <Plus size={20}/> Nueva Reserva
        </button>
      </div>

      {isDemo && (
          <div className="mb-4 bg-orange-50 text-orange-800 p-3 rounded-lg flex items-center gap-2 text-sm border border-orange-200">
              <Lock size={16} />
              <span><strong>Modo Demo:</strong> Gestión de reservas simulada. No afecta la agenda real.</span>
          </div>
      )}

      {/* FORMULARIO MODAL */}
      {isFormOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-gray-800">{editingId ? 'Editar Reserva' : 'Nueva Reserva'}</h3>
                      <button onClick={closeForm}><X size={20} className="text-gray-400 hover:text-gray-600"/></button>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase">Cliente</label>
                          <input className="w-full p-3 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-pink-500 outline-none" 
                              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Nombre completo"/>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-xs font-bold text-gray-500 uppercase">Fecha</label>
                              <input type="date" className="w-full p-3 border rounded-lg bg-gray-50 focus:bg-white outline-none" 
                                  value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-gray-500 uppercase">Hora</label>
                              <input type="time" className="w-full p-3 border rounded-lg bg-gray-50 focus:bg-white outline-none" 
                                  value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
                          </div>
                      </div>

                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase">Personas</label>
                          <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-lg border">
                              <Users size={20} className="text-gray-400"/>
                              <input type="range" min="1" max="20" className="flex-1 accent-pink-600"
                                  value={formData.people} onChange={e => setFormData({...formData, people: Number(e.target.value)})} />
                              <span className="font-bold text-lg w-8 text-center">{formData.people}</span>
                          </div>
                      </div>

                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase">Notas</label>
                          <textarea className="w-full p-3 border rounded-lg bg-gray-50 focus:bg-white outline-none h-20 resize-none" 
                              value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Ej: Cumpleaños, silla de bebé..."/>
                      </div>

                      <button onClick={handleSave} className="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-lg transition-colors">
                          Guardar Reserva
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* LISTA DE RESERVAS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                <input placeholder="Buscar reserva..." className="w-full pl-9 p-2 border rounded-lg outline-none focus:ring-1 focus:ring-pink-500" 
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
            </div>
          </div>
          
          <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500">
                  <tr>
                      <th className="p-4">Cliente</th>
                      <th className="p-4">Fecha y Hora</th>
                      <th className="p-4 text-center">Pax</th>
                      <th className="p-4">Estado</th>
                      <th className="p-4 text-right">Acciones</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                  {filteredReservations.map(res => (
                      <tr key={res.id} className="hover:bg-gray-50 group">
                          <td className="p-4">
                              <div className="font-bold text-gray-800">{res.name}</div>
                              {res.notes && <div className="text-xs text-gray-500 flex items-center gap-1"><MessageSquare size={10}/> {res.notes}</div>}
                          </td>
                          <td className="p-4">
                              <div className="flex flex-col text-sm">
                                  <span className="font-medium flex items-center gap-1"><Calendar size={12}/> {new Date(res.date).toLocaleDateString()}</span>
                                  <span className="text-gray-500 flex items-center gap-1"><Clock size={12}/> {res.time} hs</span>
                              </div>
                          </td>
                          <td className="p-4 text-center">
                              <div className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-sm font-bold text-gray-600">
                                  <Users size={12}/> {res.people}
                              </div>
                          </td>
                          <td className="p-4">
                              <span className={`px-2 py-1 rounded text-[10px] font-bold border uppercase ${getStatusColor(res.status)}`}>
                                  {res.status}
                              </span>
                          </td>
                          <td className="p-4 text-right">
                              <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                  {res.status === 'pendiente' && (
                                      <button onClick={() => handleStatusChange(res.id, 'confirmada', res.name)} className="p-2 text-green-500 hover:bg-green-50 rounded" title="Confirmar">
                                          <Check size={18}/>
                                      </button>
                                  )}
                                  {res.status !== 'cancelada' && (
                                      <button onClick={() => handleStatusChange(res.id, 'cancelada', res.name)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title="Cancelar">
                                          <X size={18}/>
                                      </button>
                                  )}
                                  
                                  <div className="w-px h-6 bg-gray-200 mx-1"></div>

                                  <button onClick={() => openForm(res)} className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Editar">
                                      <Edit size={18}/>
                                  </button>
                                  <button onClick={() => handleDelete(res.id, res.name)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded" title="Borrar">
                                      <Trash size={18}/>
                                  </button>
                              </div>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
          
          {filteredReservations.length === 0 && (
              <div className="p-10 text-center text-gray-400">
                  No hay reservas encontradas.
              </div>
          )}
      </div>
    </div>
  );
}