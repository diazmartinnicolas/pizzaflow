import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { CheckCircle, Clock, RefreshCw, AlertTriangle, ChefHat, XCircle } from 'lucide-react';

export default function Kitchen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargamos pedidos
  const fetchOrders = async () => {
    setLoading(true);
    let allOrders: any[] = [];

    // 0. VERIFICAR QUIÉN ESTÁ MIRANDO LA PANTALLA
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserEmail = user?.email?.toLowerCase() || '';
    const isDemoUser = currentUserEmail.includes('demo');

    // 1. PEDIDOS REALES (Supabase)
    try {
        const { data: realOrders } = await supabase
        .from('orders')
        .select(`
            *,
            client:clients(name),
            order_items (
                quantity,
                product:products(name)
            )
        `)
        .eq('status', 'pendiente')
        .order('created_at', { ascending: true });

        if (realOrders) allOrders = [...realOrders];
    } catch (error) {
        console.error("Error cargando pedidos reales:", error);
    }

    // 2. PEDIDOS SIMULADOS (localStorage) - ¡SOLO SI SOY DEMO!
    if (isDemoUser) {
        try {
            const demoOrdersRaw = localStorage.getItem('demo_orders');
            if (demoOrdersRaw) {
                const demoOrders = JSON.parse(demoOrdersRaw);
                const pendingDemo = demoOrders.filter((o: any) => o.status === 'pendiente');
                allOrders = [...allOrders, ...pendingDemo];
            }
        } catch (e) {
            console.warn("Error leyendo pedidos demo");
        }
    }

    // Ordenar todos por fecha
    allOrders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    setOrders(allOrders);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    const handleStorageChange = () => fetchOrders();
    window.addEventListener('storage', handleStorageChange);

    const interval = setInterval(fetchOrders, 30000);

    return () => {
        clearInterval(interval);
        window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // --- ACCIÓN: COMPLETAR (LISTO) ---
  const handleCompleteOrder = async (orderId: string) => {
    // Si es Demo
    if (orderId.toString().startsWith('demo-')) {
        const demoOrders = JSON.parse(localStorage.getItem('demo_orders') || '[]');
        const updatedDemoOrders = demoOrders.map((o: any) => 
            o.id === orderId ? { ...o, status: 'completado' } : o
        );
        localStorage.setItem('demo_orders', JSON.stringify(updatedDemoOrders));
        fetchOrders();
        return;
    }

    // Si es Real
    const { error } = await supabase
      .from('orders')
      .update({ status: 'completado' })
      .eq('id', orderId);

    if (error) {
      alert("Error al completar: " + error.message);
    } else {
      fetchOrders();
    }
  };

  // --- ACCIÓN: CANCELAR ---
  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("¿Cancelar este pedido? Desaparecerá de la pantalla.")) return;

    // Si es Demo
    if (orderId.toString().startsWith('demo-')) {
        const demoOrders = JSON.parse(localStorage.getItem('demo_orders') || '[]');
        const updatedDemoOrders = demoOrders.map((o: any) => 
            o.id === orderId ? { ...o, status: 'cancelado' } : o
        );
        localStorage.setItem('demo_orders', JSON.stringify(updatedDemoOrders));
        fetchOrders();
        return;
    }

    // Si es Real
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelado' })
      .eq('id', orderId);

    if (error) {
      alert("Error al cancelar: " + error.message);
    } else {
      fetchOrders();
    }
  };

  if (loading) return <div className="p-10 text-center text-white animate-pulse">Cargando comandas...</div>;

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <ChefHat size={32} /> Comandas de Cocina
        </h2>
        <button 
          onClick={fetchOrders} 
          className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full transition-colors"
          title="Actualizar"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center text-gray-400 mt-20">
          <CheckCircle size={64} className="mx-auto mb-4 opacity-50"/>
          <p className="text-xl">Todo limpio, chef.</p>
          <p className="text-sm">No hay pedidos pendientes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders.map((order) => {
            const isDemo = order.id.toString().startsWith('demo-');
            return (
                <div key={order.id} className={`rounded-xl shadow-lg border-l-4 overflow-hidden flex flex-col ${isDemo ? 'bg-orange-50 border-orange-500' : 'bg-white border-blue-500'}`}>
                {/* Header */}
                <div className={`p-3 border-b flex justify-between items-start ${isDemo ? 'bg-orange-100' : 'bg-gray-50'}`}>
                    <div>
                    <h3 className="font-bold text-lg text-gray-800">
                        #{order.ticket_number} 
                        {isDemo && <span className="ml-2 text-[10px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded border border-orange-300">DEMO</span>}
                    </h3>
                    <p className="text-xs text-gray-500 font-medium truncate w-32 md:w-40">{order.client?.name || 'Cliente'}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-200">
                    <Clock size={12} />
                    <span>{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                </div>

                {/* Items */}
                <div className="p-4 flex-1">
                    <ul className="space-y-3">
                    {order.order_items?.map((item: any, index: number) => (
                        <li key={index} className="flex gap-3 text-sm border-b border-dashed border-gray-100 pb-2 last:border-0 last:pb-0">
                        <span className="font-bold bg-gray-100 text-gray-800 w-6 h-6 flex items-center justify-center rounded-full text-xs flex-shrink-0">
                            {item.quantity}
                        </span>
                        <span className="text-gray-700 leading-tight">
                            {item.product?.name}
                        </span>
                        </li>
                    ))}
                    </ul>
                </div>

                {/* --- AQUÍ ESTÁN LOS 2 BOTONES --- */}
                <div className="p-3 bg-gray-50 border-t flex gap-2">
                    {/* BOTÓN 1: CANCELAR (Rojo) */}
                    <button 
                        onClick={() => handleCancelOrder(order.id)}
                        className="px-4 rounded-lg font-bold text-red-500 bg-red-50 border border-red-100 hover:bg-red-100 hover:text-red-700 transition-colors flex items-center justify-center"
                        title="Cancelar Pedido"
                    >
                        <XCircle size={20} />
                    </button>

                    {/* BOTÓN 2: LISTO (Verde/Naranja) */}
                    <button 
                        onClick={() => handleCompleteOrder(order.id)}
                        className={`flex-1 py-3 rounded-lg font-bold text-white shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${isDemo ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                        <CheckCircle size={18} /> Listo
                    </button>
                </div>
                </div>
            );
          })}
        </div>
      )}
    </div>
  );
}