import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Clock, Check, X, ChefHat, RefreshCw } from 'lucide-react';

export default function Kitchen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();

    // Suscripción en tiempo real (Opcional: para que aparezcan solos sin recargar)
    const channel = supabase
      .channel('realtime:orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    // Traemos pedidos pendientes con sus items y datos del cliente
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        clients (name),
        order_items (
          quantity,
          products (name)
        )
      `)
      .eq('status', 'pendiente') // Solo mostramos lo pendiente
      .order('created_at', { ascending: true }); // Los más viejos primero

    if (error) console.error('Error fetching orders:', error);
    if (data) setOrders(data);
    setLoading(false);
  };

  const markAsReady = async (orderId: string) => {
    // Actualizamos estado a 'completado'
    const { error } = await supabase.from('orders').update({ status: 'completado' }).eq('id', orderId);
    if (!error) fetchOrders();
  };

  const cancelOrder = async (orderId: string) => {
    if(!confirm("¿Cancelar este pedido?")) return;
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (!error) fetchOrders();
  };

  return (
    <div className="p-6 h-full flex flex-col bg-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
          <ChefHat className="text-orange-600" /> Monitor de Cocina
        </h2>
        <button onClick={fetchOrders} className="p-2 bg-white rounded-full shadow hover:bg-gray-50 text-gray-600">
          <RefreshCw size={20} />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10">Cargando pedidos...</div>
      ) : orders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <Clock size={64} className="mb-4 text-gray-300 animate-pulse" />
          <h3 className="text-xl font-medium text-gray-500">Todo está tranquilo</h3>
          <p>A la espera de nuevos pedidos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-20">
          {orders.map((order) => (
            <div key={order.id} className="bg-white border-l-8 border-orange-500 shadow-lg rounded-lg p-4 flex flex-col animate-in fade-in slide-in-from-bottom-4">
              
              {/* Cabecera del Ticket */}
              <div className="flex justify-between items-start mb-3 border-b border-dashed pb-3">
                <div>
                  <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded">
                    TICKET #{order.ticket_number}
                  </span>
                  <h3 className="font-bold text-lg mt-1">{order.clients?.name || 'Cliente Ocasional'}</h3>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-700">
                    {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                  <p className="text-xs text-gray-400">Hora Entrada</p>
                </div>
              </div>

              {/* Lista de Items */}
              <ul className="mb-4 space-y-2 flex-1">
                {order.order_items?.map((item: any, idx: number) => (
                  <li key={idx} className="flex justify-between items-center text-gray-700 font-medium">
                    <span className="flex items-center gap-2">
                      <span className="bg-gray-200 text-gray-800 w-6 h-6 flex items-center justify-center rounded-full text-xs">
                        {item.quantity}
                      </span>
                      {item.products?.name}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Botones de Acción */}
              <div className="flex gap-2 mt-auto pt-3 border-t">
                <button 
                  onClick={() => cancelOrder(order.id)}
                  className="px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                  title="Cancelar Pedido"
                >
                  <X size={20} />
                </button>
                <button 
                  onClick={() => markAsReady(order.id)}
                  className="flex-1 bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700 flex justify-center items-center gap-2 shadow-sm active:scale-95 transition-all"
                >
                  <Check size={20} /> ¡Listo para entregar!
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}