import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { logAction } from '../services/audit'; // <--- LOGGER
import { Package, Search, Plus, Trash, Edit, X, Save, AlertTriangle, Lock } from 'lucide-react';

export default function Inventory() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  
  // Formulario
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', price: '', category: 'Pizzas' });

  const categories = ['Pizzas', 'Milanesas', 'Hamburguesas', 'Empanadas', 'Bebidas', 'Postres'];

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email || '';
    
    // MODO DEMO
    if (email.toLowerCase().includes('demo')) {
        setIsDemo(true);
        setProducts([
            { id: '1', name: 'Muzzarella (Demo)', price: 8000, category: 'Pizzas' },
            { id: '2', name: 'Coca Cola 1.5L (Demo)', price: 2500, category: 'Bebidas' },
            { id: '3', name: 'Empanada Carne (Demo)', price: 1200, category: 'Empanadas' }
        ]);
        setLoading(false);
        return;
    }

    // MODO REAL
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data);
    setLoading(false);
  };

  const handleSaveProduct = async () => {
      if (!formData.name || !formData.price) return alert("Completa los campos.");

      // DEMO
      if (isDemo) {
          const fakeProduct = { id: Date.now(), name: formData.name, price: Number(formData.price), category: formData.category };
          setProducts([fakeProduct, ...products]);
          logAction('CREAR_PRODUCTO', `(Simulado) ${formData.name}`, 'Inventario');
          setIsFormOpen(false);
          setFormData({ name: '', price: '', category: 'Pizzas' });
          alert("Producto creado en MEMORIA (Modo Demo)");
          return;
      }

      // REAL
      const { error } = await supabase.from('products').insert([{
          name: formData.name,
          price: Number(formData.price),
          category: formData.category
      }]);

      if (error) {
          alert("Error: " + error.message);
      } else {
          await logAction('CREAR_PRODUCTO', `Nuevo: ${formData.name} ($${formData.price})`, 'Inventario');
          fetchProducts();
          setIsFormOpen(false);
          setFormData({ name: '', price: '', category: 'Pizzas' });
      }
  };

  const handleDeleteProduct = async (id: any, name: string) => {
      if (!confirm("¿Borrar producto?")) return;

      if (isDemo) {
          setProducts(products.filter(p => p.id !== id));
          logAction('ELIMINAR_PRODUCTO', `(Simulado) ${name}`, 'Inventario');
          return;
      }

      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) alert("Error: " + error.message);
      else {
          await logAction('ELIMINAR_PRODUCTO', `Borrado: ${name}`, 'Inventario');
          fetchProducts();
      }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando inventario...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Package className="text-blue-600"/> Inventario
        </h2>
        <button onClick={() => setIsFormOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors">
            <Plus size={20}/> Nuevo Producto
        </button>
      </div>

      {isDemo && (
          <div className="mb-4 bg-orange-50 text-orange-800 p-3 rounded-lg flex items-center gap-2 text-sm border border-orange-200">
              <Lock size={16} />
              <span><strong>Modo Demo:</strong> Los productos creados aquí no se guardan en la base de datos.</span>
          </div>
      )}

      {/* FORMULARIO MODAL */}
      {isFormOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm">
                  <h3 className="text-xl font-bold mb-4">Nuevo Producto</h3>
                  <div className="space-y-3">
                      <input placeholder="Nombre (Ej: Pizza Rúcula)" className="w-full p-2 border rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                      <input type="number" placeholder="Precio (Ej: 12000)" className="w-full p-2 border rounded" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                      <select className="w-full p-2 border rounded bg-white" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                  </div>
                  <div className="flex gap-2 mt-4">
                      <button onClick={() => setIsFormOpen(false)} className="flex-1 py-2 text-gray-500 hover:bg-gray-100 rounded">Cancelar</button>
                      <button onClick={handleSaveProduct} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700">Guardar</button>
                  </div>
              </div>
          </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                <input placeholder="Buscar producto..." className="w-full pl-9 p-2 border rounded-lg" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
            </div>
          </div>
          <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500">
                  <tr>
                      <th className="p-4">Producto</th>
                      <th className="p-4">Categoría</th>
                      <th className="p-4 text-right">Precio</th>
                      <th className="p-4 text-center">Acciones</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                  {filteredProducts.map(product => (
                      <tr key={product.id} className="hover:bg-gray-50">
                          <td className="p-4 font-medium">{product.name}</td>
                          <td className="p-4"><span className="text-xs bg-gray-100 px-2 py-1 rounded">{product.category}</span></td>
                          <td className="p-4 text-right font-bold text-gray-700">$ {product.price.toLocaleString()}</td>
                          <td className="p-4 text-center">
                              <button onClick={() => handleDeleteProduct(product.id, product.name)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded"><Trash size={18}/></button>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>
    </div>
  );
}