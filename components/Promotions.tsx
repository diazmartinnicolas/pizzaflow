import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { logAction } from '../services/audit'; // <--- LOGGER
import { Percent, Plus, Trash, Tag, Lock, AlertTriangle } from 'lucide-react';

export default function Promotions() {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]); // Necesario para crear promos
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  
  // Formulario
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', discount: 10, prod1: '', prod2: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email || '';
    
    // Cargar productos siempre (necesarios para el select)
    const { data: prodData } = await supabase.from('products').select('*');
    if (prodData) setProducts(prodData);

    // MODO DEMO
    if (email.toLowerCase().includes('demo')) {
        setIsDemo(true);
        setPromotions([
            { id: '1', name: 'Martes de Locos (Demo)', discount_percentage: 20 },
            { id: '2', name: 'Promo Pareja (Demo)', discount_percentage: 15 }
        ]);
        setLoading(false);
        return;
    }

    // MODO REAL
    const { data } = await supabase.from('promotions').select('*');
    if (data) setPromotions(data);
    setLoading(false);
  };

  const handleSavePromo = async () => {
      if (!formData.name || !formData.prod1) return alert("Nombre y al menos 1 producto requeridos.");

      // DEMO
      if (isDemo) {
          const fakePromo = { id: Date.now(), name: formData.name, discount_percentage: formData.discount };
          setPromotions([fakePromo, ...promotions]);
          logAction('CREAR_PROMO', `(Simulado) ${formData.name} (${formData.discount}%)`, 'Promociones');
          setIsFormOpen(false);
          alert("Promoción creada en MEMORIA (Modo Demo)");
          return;
      }

      // REAL
      const { error } = await supabase.from('promotions').insert([{
          name: formData.name,
          discount_percentage: formData.discount,
          product_1_id: formData.prod1,
          product_2_id: formData.prod2 || null
      }]);

      if (error) {
          alert("Error: " + error.message);
      } else {
          await logAction('CREAR_PROMO', `Nueva: ${formData.name} (${formData.discount}%)`, 'Promociones');
          fetchData(); // Recargar real
          setIsFormOpen(false);
      }
  };

  const handleDeletePromo = async (id: any, name: string) => {
      if (!confirm("¿Borrar promoción?")) return;

      if (isDemo) {
          setPromotions(promotions.filter(p => p.id !== id));
          logAction('ELIMINAR_PROMO', `(Simulado) ${name}`, 'Promociones');
          return;
      }

      const { error } = await supabase.from('promotions').delete().eq('id', id);
      if (error) alert("Error: " + error.message);
      else {
          await logAction('ELIMINAR_PROMO', `Borrada: ${name}`, 'Promociones');
          fetchData();
      }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando promociones...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Percent className="text-purple-600"/> Promociones Activas
        </h2>
        <button onClick={() => setIsFormOpen(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700 transition-colors">
            <Plus size={20}/> Nueva Promo
        </button>
      </div>

      {isDemo && (
          <div className="mb-4 bg-orange-50 text-orange-800 p-3 rounded-lg flex items-center gap-2 text-sm border border-orange-200">
              <Lock size={16} />
              <span><strong>Modo Demo:</strong> Las promociones son ficticias.</span>
          </div>
      )}

      {/* FORMULARIO MODAL */}
      {isFormOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm">
                  <h3 className="text-xl font-bold mb-4">Nueva Promoción</h3>
                  <div className="space-y-3">
                      <input placeholder="Nombre (Ej: 2x1 Muzza)" className="w-full p-2 border rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                      
                      <div className="flex items-center gap-2">
                          <label className="text-sm font-bold text-gray-500 w-24">Descuento %</label>
                          <input type="number" className="w-full p-2 border rounded" value={formData.discount} onChange={e => setFormData({...formData, discount: Number(e.target.value)})} />
                      </div>

                      <select className="w-full p-2 border rounded bg-white" value={formData.prod1} onChange={e => setFormData({...formData, prod1: e.target.value})}>
                          <option value="">Seleccionar Producto 1 (Obligatorio)</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>

                      <select className="w-full p-2 border rounded bg-white" value={formData.prod2} onChange={e => setFormData({...formData, prod2: e.target.value})}>
                          <option value="">Seleccionar Producto 2 (Opcional)</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                  </div>
                  <div className="flex gap-2 mt-4">
                      <button onClick={() => setIsFormOpen(false)} className="flex-1 py-2 text-gray-500 hover:bg-gray-100 rounded">Cancelar</button>
                      <button onClick={handleSavePromo} className="flex-1 py-2 bg-purple-600 text-white font-bold rounded hover:bg-purple-700">Crear</button>
                  </div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promotions.map(promo => (
              <div key={promo.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center group">
                  <div>
                      <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                          <Tag size={18} className="text-purple-500"/> {promo.name}
                      </h3>
                      <span className="inline-block mt-2 bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">
                          {promo.discount_percentage}% OFF
                      </span>
                  </div>
                  <button onClick={() => handleDeletePromo(promo.id, promo.name)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash size={20}/>
                  </button>
              </div>
          ))}
      </div>
    </div>
  );
}