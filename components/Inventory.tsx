import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { logAction } from '../services/audit';
import { z } from 'zod';
import { ProductSchema } from '../schemas/products';
import {
  Package, Plus, Search, Edit, Trash2, X,
  Save, AlertCircle, CheckCircle, Filter
} from 'lucide-react';
import { TableRowSkeleton } from './ui/Skeleton';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// Categorías del sistema
const CATEGORIES = [
  'Pizzas', 'Mitades', 'Milanesas', 'Hamburguesas',
  'Empanadas', 'Ensaladas', 'Bebidas', 'Postres'
];

// 👇 1. Definimos que este componente acepta una función de aviso
interface InventoryProps {
  onProductUpdate?: () => void;
}

export default function Inventory({ onProductUpdate }: InventoryProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: 'Pizzas',
    price: 0,
    active: true,
    is_favorite: false
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Filtramos explícitamente los no borrados para asegurar la consistencia
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .is('deleted_at', null)
        .order('name');

      if (error) throw error;
      if (data) setProducts(data);
    } catch (error) {
      console.error("Error cargando inventario:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLERS ---

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({ name: '', category: 'Pizzas', price: 0, active: true, is_favorite: false });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      price: product.price,
      active: product.active,
      is_favorite: product.is_favorite || false
    });
    setIsModalOpen(true);
  };

  // Búscala dentro de src/components/Inventory.tsx y reemplázala por esta versión:

  const handleSave = async () => {
    try {
      // 1. Validación de formulario
      ProductSchema.parse(formData);

      if (editingProduct) {
        // --- MODO EDICIÓN (Normal) ---
        const { error } = await supabase
          .from('products')
          .update(formData)
          .eq('id', editingProduct.id);

        if (error) throw error;
        await logAction('EDITAR_PROD', `Producto: ${formData.name}`, 'Inventario');
        toast.success("Producto actualizado");

      } else {
        // --- MODO CREACIÓN (Con Truco de Reciclaje) ---

        // Paso A: Verificamos si ya existe ese nombre (incluso si está borrado)
        const { data: existingProduct, error: searchError } = await supabase
          .from('products')
          .select('*')
          .eq('name', formData.name) // Buscamos coincidencia exacta de nombre
          .maybeSingle(); // Usamos maybeSingle para que no de error si no encuentra nada

        if (searchError) throw searchError;

        if (existingProduct) {
          // Paso B: Si existe...
          if (existingProduct.deleted_at) {
            // ...y está borrado: ¡LO REVIVIMOS! 🧟‍♂️
            // Confirmamos si el usuario quiere restaurarlo o lo hacemos silencioso
            // Aquí lo hacemos automático para mejor experiencia:
            const { error } = await supabase
              .from('products')
              .update({
                ...formData,       // Ponemos los nuevos datos (precio, cat, etc)
                deleted_at: null,  // Quitamos la marca de borrado
                active: true       // Lo activamos
              })
              .eq('id', existingProduct.id);

            if (error) throw error;
            await logAction('RESTAURAR_PROD', `Restaurado: ${formData.name}`, 'Inventario');
            toast.info(`♻️ El producto "${formData.name}" existía en la papelera y ha sido recuperado.`);

          } else {
            // ...y está activo: Es un duplicado real. Error.
            toast.error("¡Ya existe un producto activo con este nombre!");
            return; // Salir de la función si hay un duplicado activo
          }
        } else {
          // Paso C: No existe nada, creamos uno nuevo (Normal)
          const { error } = await supabase
            .from('products')
            .insert([formData]);

          if (error) throw error;
          await logAction('CREAR_PROD', `Nuevo: ${formData.name}`, 'Inventario');
          toast.success("Producto creado con éxito");
        }
      }

      // Finalizar: Recargamos todo
      fetchProducts();
      setIsModalOpen(false);

      // Avisamos a App.tsx
      if (onProductUpdate) onProductUpdate();

    } catch (error: any) {
      // Manejo de errores
      if (error instanceof z.ZodError) {
        toast.error("⚠️ Validación: " + error.issues[0].message);
      } else {
        console.error("Error guardando:", error);
        // Si el error es de duplicado (por si acaso falló nuestra lógica anterior), lo traducimos
        if (error.message.includes('unique constraint') || error.code === '23505') {
          toast.error("⚠️ Error: Ya existe un producto con ese nombre exacto.");
        } else {
          toast.error("Error: " + error.message);
        }
      }
    }
  };

  // --- SOFT DELETE CORREGIDO ---
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;

    // 👇 3. ACTUALIZACIÓN OPTIMISTA (VISUAL INSTANTÁNEA)
    // Borramos el item de la lista visualmente ANTES de que termine la base de datos.
    // Esto hace que se sienta super rápido y arregla el "no se borra".
    setProducts(current => current.filter(p => p.id !== id));

    try {
      const { error } = await supabase
        .from('products')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      await logAction('BORRAR_PROD', `Eliminado (Soft): ${name}`, 'Inventario');
      toast.success("Producto eliminado");

      // 👇 4. AVISAMOS A LA APP PRINCIPAL
      if (onProductUpdate) onProductUpdate();

    } catch (error: any) {
      toast.error("Error eliminando: " + error.message);
      // Si falló, volvemos a cargar la lista real para deshacer el cambio visual
      fetchProducts();
    }
  };

  // --- FILTRADO ---
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 h-full flex flex-col bg-gray-50">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <Package size={32} className="text-orange-500" /> Inventario de Productos
          </h2>
          <p className="text-sm text-gray-500 mt-1">Gestiona tu carta, precios y disponibilidad.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 font-bold transition-colors"
        >
          <Plus size={20} /> Nuevo Producto
        </button>
      </div>

      {/* BARRA DE BÚSQUEDA */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex items-center gap-4">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={18} /></div>
          <input
            type="text"
            placeholder="Buscar por nombre o categoría..."
            className="w-full pl-10 p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border">
          <Filter size={16} />
          <span>{filteredProducts.length} productos</span>
        </div>
      </div>

      {/* TABLA DE PRODUCTOS */}
      <div className="flex-1 overflow-auto bg-white rounded-xl shadow-sm border border-gray-200">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-500 font-bold text-xs uppercase tracking-wider sticky top-0 z-10">
            <tr>
              <th className="p-4 border-b">Nombre</th>
              <th className="p-4 border-b">Categoría</th>
              <th className="p-4 border-b">Precio</th>
              <th className="p-4 border-b text-center">Estado</th>
              <th className="p-4 border-b text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <>
                <TableRowSkeleton cols={5} />
                <TableRowSkeleton cols={5} />
                <TableRowSkeleton cols={5} />
                <TableRowSkeleton cols={5} />
                <TableRowSkeleton cols={5} />
              </>
            ) : filteredProducts.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400 font-medium italic">Sin productos.</td></tr>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((p) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="hover:bg-gray-50 transition-colors group"
                  >
                    <td className="p-4 font-medium text-gray-800">{p.name}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-bold text-gray-600 border border-gray-200">
                        {p.category}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-gray-700">${p.price}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${p.active ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        {p.active ? 'Activo' : 'Pausado'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenEdit(p)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar"><Edit size={18} /></button>
                        <button onClick={() => handleDelete(p.id, p.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </tbody>
        </table >
      </div >

      {/* MODAL CREAR / EDITAR */}
      {
        isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-lg text-gray-800">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nombre del Producto</label>
                  <input
                    autoFocus
                    type="text"
                    className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Ej: Pizza Muzzarella"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Categoría</label>
                    <select
                      className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Precio</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                      <input
                        type="number"
                        className="w-full pl-8 p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                        value={formData.price}
                        onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                      checked={formData.active}
                      onChange={e => setFormData({ ...formData, active: e.target.checked })}
                    />
                    <span className="text-sm font-medium text-gray-700">Disponible para venta</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-yellow-500 rounded focus:ring-yellow-500"
                      checked={formData.is_favorite}
                      onChange={e => setFormData({ ...formData, is_favorite: e.target.checked })}
                    />
                    <span className="text-sm font-medium text-gray-700">Destacado (Estrella)</span>
                  </label>
                </div>

                <button
                  onClick={handleSave}
                  className="w-full mt-4 bg-gray-900 hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={20} /> Guardar Producto
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}