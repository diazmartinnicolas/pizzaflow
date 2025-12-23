import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Percent, Save, Trash, Tag } from 'lucide-react';

export default function Promotions() {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]); // Para llenar los desplegables
  const [loading, setLoading] = useState(false);

  // Datos del formulario
  const [name, setName] = useState('');
  const [prod1, setProd1] = useState('');
  const [prod2, setProd2] = useState('');
  const [discount, setDiscount] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // 1. Traer productos para los selectores
    const { data: prodData } = await supabase.from('products').select('*').eq('active', true).order('name');
    if (prodData) setProducts(prodData);

    // 2. Traer promociones existentes
    const { data: promoData } = await supabase
      .from('promotions')
      .select(`
        *,
        p1:product_1_id (name),
        p2:product_2_id (name)
      `)
      .order('created_at', { ascending: false });
    
    if (promoData) setPromotions(promoData);
  };

  const handleCreate = async () => {
    if (!name || !prod1 || !discount) return alert("Falta completar datos (Nombre, Producto 1 y Descuento son obligatorios)");
    
    setLoading(true);
    const { error } = await supabase.from('promotions').insert([
      {
        name,
        product_1_id: prod1,
        product_2_id: prod2 || null, // El producto 2 es opcional
        discount_percentage: parseInt(discount)
      }
    ]);

    if (error) {
      alert("Error al guardar: " + error.message);
    } else {
      // Limpiar formulario y recargar
      setName('');
      setProd1('');
      setProd2('');
      setDiscount('');
      fetchData();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if(!confirm("¿Borrar promoción?")) return;
    const { error } = await supabase.from('promotions').delete().eq('id', id);
    if (!error) fetchData();
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-800">
        <Percent className="text-pink-600"/> Gestión de Promociones
      </h2>

      {/* Formulario de Creación */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8 max-w-3xl">
        <h3 className="font-bold text-lg mb-4 text-gray-700">Crear Nueva Promo</h3>
        <div className="space-y-4">
          
          <input 
            type="text" 
            placeholder="Nombre de la Promo (ej: Pepperino Flow)" 
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" 
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select 
              className="p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-pink-500 outline-none"
              value={prod1}
              onChange={(e) => setProd1(e.target.value)}
            >
              <option value="">Seleccionar Producto 1 (Requerido)</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} - ${p.price}</option>)}
            </select>

            <select 
              className="p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-pink-500 outline-none"
              value={prod2}
              onChange={(e) => setProd2(e.target.value)}
            >
              <option value="">Seleccionar Producto 2 (Opcional)</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} - ${p.price}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-32">
              <input 
                type="number" 
                placeholder="10" 
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none pr-8" 
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">%</span>
            </div>
            <span className="text-gray-600 font-medium">de Descuento</span>
          </div>

          <button 
            onClick={handleCreate} 
            disabled={loading}
            className="w-full bg-pink-600 text-white py-3 rounded-lg hover:bg-pink-700 font-bold flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Save size={20} /> {loading ? 'Guardando...' : 'Guardar Promoción'}
          </button>
        </div>
      </div>

      {/* Lista de Promociones Activas */}
      <h3 className="font-bold text-xl mb-4 text-gray-700">Promociones Vigentes</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {promotions.map(promo => (
          <div key={promo.id} className="bg-white p-5 rounded-xl shadow-sm border border-pink-100 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-pink-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
              {promo.discount_percentage}% OFF
            </div>
            <div>
              <h4 className="font-bold text-lg text-gray-800 mb-2 flex items-center gap-2">
                <Tag size={18} className="text-pink-500" /> {promo.name}
              </h4>
              <ul className="text-sm text-gray-600 space-y-1 mb-4">
                <li className="flex items-center gap-2">🍕 {promo.p1?.name || 'Producto eliminado'}</li>
                {promo.p2 && <li className="flex items-center gap-2">➕ {promo.p2.name}</li>}
              </ul>
            </div>
            <button 
              onClick={() => handleDelete(promo.id)}
              className="mt-auto w-full border border-red-200 text-red-500 py-2 rounded-lg hover:bg-red-50 flex items-center justify-center gap-2 text-sm transition-colors"
            >
              <Trash size={16} /> Eliminar Promo
            </button>
          </div>
        ))}
        {promotions.length === 0 && <p className="text-gray-400 col-span-3">No hay promociones creadas.</p>}
      </div>
    </div>
  );
}