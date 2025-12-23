import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Plus, Edit, Trash, Search, X } from 'lucide-react';

export default function Inventory() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Estado para el buscador
  const [searchTerm, setSearchTerm] = useState('');

  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: 'Pizzas' });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data);
  };

  const handleCreate = async () => {
    if (!newProduct.name || !newProduct.price) return alert("Falta nombre o precio");
    setLoading(true);
    
    const { error } = await supabase.from('products').insert([
      { 
        name: newProduct.name, 
        price: parseFloat(newProduct.price), 
        category: newProduct.category
      }
    ]);

    if (error) {
      alert("Error al crear: " + error.message);
    } else {
      setIsCreating(false);
      setNewProduct({ name: '', price: '', category: 'Pizzas' }); 
      fetchProducts();
    }
    setLoading(false);
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('products').update({ active: !currentStatus }).eq('id', id);
    if (!error) fetchProducts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de borrar este producto?")) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) fetchProducts();
  };

  // Lógica del Buscador: Filtramos los productos antes de mostrarlos
  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Encabezado con Título, Buscador y Botón Nuevo */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-800">📦 Inventario</h2>
        
        <div className="flex gap-3 w-full md:w-auto">
          {/* BUSCADOR */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar producto..." 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>

          <button 
            onClick={() => setIsCreating(!isCreating)} 
            className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-orange-700 transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus size={20} /> {isCreating ? 'Cancelar' : 'Nuevo'}
          </button>
        </div>
      </div>

      {/* Formulario de Creación */}
      {isCreating && (
        <div className="bg-white p-6 rounded-xl mb-6 shadow-md border-l-4 border-orange-500 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-bold mb-4 text-gray-700">Agregar Nuevo Item</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
              <input 
                placeholder="Ej: Milanesa a Caballo" 
                className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 outline-none" 
                value={newProduct.name} 
                onChange={e => setNewProduct({...newProduct, name: e.target.value})} 
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Categoría</label>
              <select 
                className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 outline-none bg-white" 
                value={newProduct.category} 
                onChange={e => setNewProduct({...newProduct, category: e.target.value})}
              >
                <option>Pizzas</option>
                <option>Milanesas</option> {/* Agregado */}
                <option>Hamburguesas</option> {/* Agregado */}
                <option>Empanadas</option>
                <option>Bebidas</option>
                <option>Postres</option>
                <option>Promociones</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Precio ($ ARS)</label>
              <input 
                type="number" 
                placeholder="Ej: 16000" 
                className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 outline-none" 
                value={newProduct.price} 
                onChange={e => setNewProduct({...newProduct, price: e.target.value})} 
              />
            </div>

            <button 
              onClick={handleCreate} 
              disabled={loading} 
              className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 font-bold w-full transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* CONTENEDOR DE LA TABLA CON SCROLL */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
        {/* Cabecera Fija */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold tracking-wider sticky top-0 z-10">
              <tr>
                <th className="p-4 w-1/3">Producto</th>
                <th className="p-4">Categoría</th>
                <th className="p-4">Precio</th>
                <th className="p-4 text-center">Estado</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
          </table>
        </div>

        {/* Cuerpo con Scroll Vertical (max-height ajustado) */}
        <div className="overflow-y-auto max-h-[65vh]">
          <table className="w-full text-left">
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="p-4 w-1/3 font-medium text-gray-800">{product.name}</td>
                  
                  <td className="p-4">
                    <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded-md text-xs font-medium border border-orange-100">
                      {product.category}
                    </span>
                  </td>
                  
                  <td className="p-4 font-bold text-gray-700">
                    $ {product.price.toLocaleString('es-AR')}
                  </td>
                  
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => toggleStatus(product.id, product.active)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                        product.active 
                        ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {product.active ? 'ACTIVO' : 'INACTIVO'}
                    </button>
                  </td>
                  
                  <td className="p-4 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(product.id)} 
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                      title="Borrar"
                    >
                      <Trash size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-gray-400">
                    {searchTerm ? 'No se encontraron productos con ese nombre.' : 'No hay productos cargados.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}