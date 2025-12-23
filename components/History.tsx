import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Calendar, Search, Eye, ShoppingBag, X } from 'lucide-react';

export default function History() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null); // Para el modal de detalles

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    // Traemos las órdenes, el nombre del cliente y el detalle de items
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        clients (name),
        order_items (
          quantity,
          price_at_moment,
          products (name)
        )
      `)
      .order('created_at', { ascending: false }); // Las más nuevas primero

    if (error) console.error('Error cargando historial:', error);
    if (data) setOrders(data);
    setLoading(false);
  };

  // Formatear fecha para que se lea bien en Argentina
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Calendar className="text-purple-600"/> Historial de Ventas
        </h2>
      </div>

      {/* TABLA DE VENTAS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold sticky top-0">
              <tr>
                <th className="p-4">Fecha y Hora</th>
                <th className="p-4">Ticket</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Total</th>
                <th className="p-4 text-center">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center">Cargando movimientos...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">No hay movimientos registrados aún.</td></tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-gray-600 text-sm">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="p-4 font-mono text-xs font-bold bg-gray-50 rounded text-gray-600 w-max">
                      #{order.ticket_number}
                    </td>
                    <td className="p-4 font-medium text-gray-800">
                      {order.clients?.name || 'Consumidor Final'}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                        order.status === 'completado' ? 'bg-green-100 text-green-700' :
                        order.status === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-gray-800">
                      $ {order.total.toLocaleString('es-AR')}
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => setSelectedOrder(order)}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Ver qué compró"
                      >
                        <Eye size={20} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE DETALLE (Se abre al hacer click en el ojito) */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 overflow-hidden">
            <div className="bg-purple-600 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold flex items-center gap-2">
                <ShoppingBag size={20}/> Ticket #{selectedOrder.ticket_number}
              </h3>
              <button onClick={() => setSelectedOrder(null)} className="hover:bg-purple-700 p-1 rounded">
                <X size={20}/>
              </button>
            </div>
            
            <div className="p-6">
              <div className="flex justify-between text-sm text-gray-500 mb-4 border-b pb-2">
                <span>{formatDate(selectedOrder.created_at)}</span>
                <span>Cliente: {selectedOrder.clients?.name}</span>
              </div>

              <div className="space-y-3 mb-6">
                <p className="text-xs font-bold text-gray-400 uppercase">Productos</p>
                {selectedOrder.order_items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className="bg-gray-100 px-2 py-1 rounded font-bold text-gray-600">x{item.quantity}</span>
                      <span>{item.products?.name}</span>
                    </div>
                    <span className="text-gray-600">
                      $ {(item.price_at_moment * item.quantity).toLocaleString('es-AR')}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 flex justify-between items-center text-xl font-bold text-gray-800">
                <span>Total Cobrado</span>
                <span className="text-purple-600">$ {selectedOrder.total.toLocaleString('es-AR')}</span>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 text-center">
              <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}