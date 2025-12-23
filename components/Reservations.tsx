import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { CalendarClock, Plus, Search, Trash, Users, Phone, Clock, Calendar as CalIcon, X, Save } from 'lucide-react';

export default function Reservations() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Formulario
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    phone: '',
    date: new Date().toISOString().split('T')[0], // Hoy por defecto
    time: '21:00',
    pax: 2,
    notes: ''
  });

  useEffect(() => {
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    setLoading(true);
    // Traemos reservas ordenadas por fecha (las más próximas primero)
    const { data } = await supabase
      .from('reservations')
      .select('*')
      .gte('reservation_date', new Date().toISOString().split('T')[0]) // Solo futuras o de hoy
      .order('reservation_date', { ascending: true })
      .order('reservation_time', { ascending: true });
    
    if (data) setReservations(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.date || !formData.time) return alert("Faltan datos obligatorios");

    const { error } = await supabase.from('reservations').insert([{
      name: formData.name,
      surname: formData.surname,
      phone: formData.phone,
      reservation_date: formData.date,
      reservation_time: formData.time,
      pax: formData.pax,
      notes: formData.notes
    }]);

    if (error) {
      alert("Error al guardar: " + error.message);
    } else {
      setShowModal(false);
      setFormData({ ...formData, name: '', surname: '', phone: '', notes: '' }); // Limpiar
      fetchReservations();
    }
  };

  const handleDelete = async (id: string) => {
    if(!confirm("¿Borrar esta reserva?")) return;
    await supabase.from('reservations').delete().eq('id', id);
    fetchReservations();
  };

  // Función auxiliar para formatear fecha visualmente
  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}`;
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <CalendarClock className="text-pink-600"/> Libro de Reservas
        </h2>
        <button 
          onClick={() => setShowModal(true)} 
          className="bg-pink-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-pink-700 shadow-sm"
        >
          <Plus size={20} /> Nueva Reserva
        </button>
      </div>

      {/* LISTA DE RESERVAS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
           {loading ? (
             <div className="p-8 text-center text-gray-500">Cargando reservas...</div>
           ) : reservations.length === 0 ? (
             <div className="p-12 text-center text-gray-400">
               <CalendarClock size={48} className="mx-auto mb-4 opacity-20"/>
               <p>No hay reservas próximas.</p>
             </div>
           ) : (
             <table className="w-full text-left">
               <thead className="bg-pink-50 text-pink-800 uppercase text-xs font-semibold sticky top-0">
                 <tr>
                   <th className="p-4">Fecha</th>
                   <th className="p-4">Hora</th>
                   <th className="p-4">Cliente</th>
                   <th className="p-4">Personas</th>
                   <th className="p-4">Contacto</th>
                   <th className="p-4 text-right">Acción</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {reservations.map((res) => (
                   <tr key={res.id} className="hover:bg-gray-50 group">
                     <td className="p-4 font-bold text-gray-600 flex items-center gap-2">
                       <CalIcon size={16} className="text-pink-400"/> {formatDate(res.reservation_date)}
                     </td>
                     <td className="p-4 font-mono text-pink-600 font-bold">
                       {res.reservation_time.slice(0,5)} hs
                     </td>
                     <td className="p-4">
                       <span className="font-bold text-gray-800">{res.name} {res.surname}</span>
                       {res.notes && <p className="text-xs text-orange-500 italic mt-1">Nota: {res.notes}</p>}
                     </td>
                     <td className="p-4 text-gray-600">
                       <span className="flex items-center gap-1"><Users size={16}/> {res.pax}</span>
                     </td>
                     <td className="p-4 text-sm text-gray-500">
                       {res.phone ? <span className="flex items-center gap-1"><Phone size={14}/> {res.phone}</span> : '-'}
                     </td>
                     <td className="p-4 text-right">
                       <button onClick={() => handleDelete(res.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                         <Trash size={18}/>
                       </button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           )}
        </div>
      </div>

      {/* MODAL NUEVA RESERVA */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 overflow-hidden">
            <div className="bg-pink-600 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold flex items-center gap-2"><Plus size={20}/> Agregar Reserva</h3>
              <button onClick={() => setShowModal(false)}><X size={20}/></button>
            </div>
            
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Fecha</label>
                <input type="date" className="w-full p-2 border rounded" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <div className="col-span-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Hora</label>
                <input type="time" className="w-full p-2 border rounded" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
              </div>

              <div className="col-span-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Nombre</label>
                <input type="text" placeholder="Ej: Lionel" className="w-full p-2 border rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="col-span-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Apellido</label>
                <input type="text" placeholder="Ej: Messi" className="w-full p-2 border rounded" value={formData.surname} onChange={e => setFormData({...formData, surname: e.target.value})} />
              </div>

              <div className="col-span-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Teléfono</label>
                <input type="text" placeholder="11..." className="w-full p-2 border rounded" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="col-span-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Personas (Pax)</label>
                <input type="number" min="1" className="w-full p-2 border rounded" value={formData.pax} onChange={e => setFormData({...formData, pax: parseInt(e.target.value)})} />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Notas (Opcional)</label>
                <input type="text" placeholder="Ej: Cumpleaños, traer silla bebé..." className="w-full p-2 border rounded" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>
            </div>

            <div className="p-4 bg-gray-50 text-right flex gap-2 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded">Cancelar</button>
              <button onClick={handleSave} className="px-6 py-2 bg-pink-600 text-white font-bold rounded hover:bg-pink-700 flex items-center gap-2">
                <Save size={18}/> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}