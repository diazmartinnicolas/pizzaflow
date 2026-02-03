import { useEffect, useState, useRef, forwardRef } from 'react';
import { supabase } from '../services/supabase';
import { useReactToPrint } from 'react-to-print';
import { CheckCircle, Clock, RefreshCw, ChefHat, XCircle, Printer } from 'lucide-react';
// IMPORTAMOS EL BOTÓN NUEVO
import { WhatsAppButton } from './WhatsAppButton';

// --- COMPONENTE TICKET TÉRMICO (Visible solo al imprimir) ---
const KitchenTicket = forwardRef<HTMLDivElement, { order: any; companyName?: string }>(({ order, companyName }, ref) => {
  if (!order) return null;

  // Normalizamos el texto de pago
  const paymentMethod = order.payment_type ? order.payment_type.toUpperCase() : 'EFECTIVO';

  // --- LÓGICA DE ORDENAMIENTO ---
  const sortedItems = [...(order.order_items || [])].sort((a: any, b: any) => {
    const catA = a.product?.category || '';
    const catB = b.product?.category || '';
    const nameA = a.product?.name || '';
    const nameB = b.product?.name || '';

    const catComparison = catA.localeCompare(catB);
    if (catComparison !== 0) return catComparison;
    return nameA.localeCompare(nameB);
  });

  return (
    <div ref={ref} className="hidden print:block p-4 bg-white text-black font-mono text-sm w-[80mm] mx-auto leading-tight">

      {/* 1. HEADER */}
      <div className="text-center mb-4 border-b border-black pb-2 border-dashed">
        <h2 className="font-black text-2xl uppercase leading-none mb-2">
          {companyName || 'FLUXO KITCHEN'}
        </h2>
        <p className="text-[10px]">
          {new Date().toLocaleDateString()} - {new Date().toLocaleTimeString()}
        </p>
      </div>

      {/* 2. INFO TICKET, PAGO Y CLIENTE */}
      <div className="mb-4 border-b border-black border-dashed pb-2">
        <div className="flex justify-between items-end font-bold text-xl mb-1">
          <span>TICKET:</span>
          <span>#{order.ticket_number}</span>
        </div>

        <div className="text-right mb-3">
          <span className="text-sm font-black border-2 border-black px-2 py-0.5 rounded-sm uppercase">
            PAGO: {paymentMethod}
          </span>
        </div>

        <div className="text-sm font-bold uppercase space-y-2">
          <div>
            <span className="text-xs font-normal block mb-0.5">Cliente / Dirección:</span>

            {/* Nombre del Cliente */}
            <span className="text-base block">{order.client?.name || 'Mostrador'}</span>

            {/* --- NUEVO: DIRECCIÓN AGREGADA --- */}
            <span className="text-sm block font-medium mt-0.5">
              {order.client?.address || 'Retira en local / Sin dirección'}
            </span>
          </div>

          <div>
            <span className="text-xs font-normal block mb-0.5">Teléfono:</span>
            <span>{order.client?.phone || 'Sin teléfono'}</span>
          </div>
        </div>

        <p className="text-[10px] mt-2 text-right">
          Ingreso: {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* ITEMS (ORDENADOS) */}
      <div className="border-b border-black border-dashed py-2 mb-4">
        <ul className="space-y-3">
          {sortedItems.map((item: any, index: number) => {
            const displayName = item.item_name || item.product?.name || 'Item';
            const notes = item.notes || '';

            return (
              <li key={index} className="flex flex-col gap-0.5">
                <div className="flex gap-2 items-start">
                  <span className="font-black text-lg w-6 text-right leading-none">{item.quantity}</span>
                  <span className="mx-1 pt-1">x</span>
                  <span className="flex-1 text-lg font-bold uppercase leading-none pt-0.5">
                    {displayName}
                  </span>
                </div>
                {notes && (
                  <span className="text-xs text-gray-600 ml-10 italic">
                    ({notes})
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* SECCIÓN DE NOTAS */}
      <div className="mb-4">
        <p className="text-xs font-bold mb-1">OBSERVACIONES:</p>
        <div className="w-full h-24 border-2 border-black border-dashed rounded-md"></div>
      </div>

      {/* FOOTER */}
      <div className="text-center text-xs font-bold mt-2">
        <p>*** FIN DE ORDEN ***</p>
      </div>
    </div>
  );
});

interface KitchenProps {
  demoOrders?: any[];
  onDemoComplete?: (id: any) => void;
  companyName?: string;
}

export default function Kitchen({ demoOrders = [], onDemoComplete, companyName }: KitchenProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- ESTADO PARA IMPRESIÓN ---
  const [printingOrder, setPrintingOrder] = useState<any>(null);
  const componentRef = useRef<HTMLDivElement>(null);

  // Hook de impresión
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: printingOrder ? `Comanda-${printingOrder.ticket_number}` : 'Comanda',
  });

  // --- CARGA DE DATOS REALES (SUPABASE) ---
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data: realOrders, error } = await supabase
        .from('orders')
        .select(`
            *,
            client:clients(name, phone, address),
            order_items (
                quantity,
                item_name,
                notes,
                product:products(name, category)
            )
        `)
        .eq('status', 'pendiente')
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (realOrders) setOrders(realOrders);

    } catch (error) {
      console.error("Error cargando pedidos reales:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  // --- HANDLERS ---
  const handleCompleteOrder = async (orderId: string | number) => {
    if (onDemoComplete && demoOrders.some(o => o.id === orderId)) {
      onDemoComplete(orderId);
      return;
    }
    const { error } = await supabase
      .from('orders')
      .update({ status: 'completado' })
      .eq('id', orderId);

    if (error) alert("Error al completar: " + error.message);
    else fetchOrders();
  };

  const handleCancelOrder = async (orderId: string | number) => {
    if (!confirm("¿Seguro que deseas CANCELAR este pedido?")) return;

    if (onDemoComplete && demoOrders.some(o => o.id === orderId)) {
      onDemoComplete(orderId);
      return;
    }
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelado' })
      .eq('id', orderId);

    if (error) alert("Error al cancelar: " + error.message);
    else fetchOrders();
  };

  // Función trigger de impresión
  const onPrintClick = (order: any) => {
    setPrintingOrder(order);
    setTimeout(() => {
      handlePrint();
    }, 100);
  };

  // --- MERGE DE DATOS ---
  const allOrders = [...demoOrders, ...orders].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  if (loading && allOrders.length === 0) return <div className="p-10 text-center text-gray-500 animate-pulse">Cargando comandas...</div>;

  return (
    <div className="p-6 h-full overflow-y-auto bg-gray-50 min-h-screen relative">

      {/* COMPONENTE OCULTO PARA IMPRESIÓN */}
      <div className="hidden">
        <KitchenTicket ref={componentRef} order={printingOrder} companyName={companyName} />
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <ChefHat size={32} className="text-orange-500" /> Comandas de Cocina
        </h2>
        <button
          onClick={fetchOrders}
          className="bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors shadow-sm"
          title="Actualizar"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {allOrders.length === 0 ? (
        <div className="text-center text-gray-400 mt-20 flex flex-col items-center">
          <CheckCircle size={64} className="mb-4 opacity-20" />
          <p className="text-xl font-medium">Todo limpio, chef.</p>
          <p className="text-sm mt-1">No hay pedidos pendientes en cola.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {allOrders.map((order) => {
            const isDemo = demoOrders.some(d => d.id === order.id);

            return (
              <div key={order.id} className={`rounded-xl shadow-lg border-l-4 overflow-hidden flex flex-col transition-all animate-in fade-in zoom-in duration-300 ${isDemo ? 'bg-orange-50 border-orange-500' : 'bg-white border-blue-500'}`}>
                {/* Header Ticket (Vista en Pantalla) */}
                <div className={`p-3 border-b flex justify-between items-start ${isDemo ? 'bg-orange-100 text-orange-900' : 'bg-gray-50 text-gray-800'}`}>
                  <div>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      #{order.ticket_number || (typeof order.id === 'string' ? order.id.slice(-4) : order.id)}
                      {isDemo && <span className="text-[10px] bg-orange-600 text-white px-1.5 py-0.5 rounded uppercase">Demo</span>}
                    </h3>
                    <p className={`text-xs font-medium truncate w-32 md:w-40 ${isDemo ? 'text-orange-800' : 'text-gray-500'}`}>
                      {order.client?.name || 'Cliente Mostrador'}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${isDemo ? 'bg-white border-orange-200 text-orange-800' : 'bg-white border-gray-200 text-gray-500'}`}>
                    <Clock size={12} />
                    <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="p-4 flex-1 text-gray-700">
                  <ul className="space-y-3">
                    {order.order_items?.map((item: any, index: number) => {
                      // Priorizar item_name (nombre personalizado/promoción) sobre product.name
                      const displayName = item.item_name || item.product?.name || 'Item';
                      const notes = item.notes || '';

                      return (
                        <li key={index} className={`border-b border-dashed pb-2 last:border-0 last:pb-0 ${isDemo ? 'border-orange-200' : 'border-gray-100'}`}>
                          <div className="flex gap-3 text-sm">
                            <span className={`font-bold w-6 h-6 flex items-center justify-center rounded-full text-xs flex-shrink-0 ${isDemo ? 'bg-orange-200 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>
                              {item.quantity}
                            </span>
                            <div className="flex-1">
                              <span className="leading-tight font-medium block">
                                {displayName}
                              </span>
                              {/* Mostrar productos incluidos si es una promoción */}
                              {notes && (
                                <span className="text-[10px] text-gray-400 block mt-0.5">
                                  ({notes})
                                </span>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Footer Actions */}
                <div className={`p-3 border-t flex gap-2 ${isDemo ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'}`}>

                  {/* BOTÓN IMPRIMIR */}
                  <button
                    onClick={() => onPrintClick(order)}
                    className="p-3 rounded-lg font-bold border transition-colors flex items-center justify-center bg-gray-100 border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                    title="Imprimir Comanda"
                  >
                    <Printer size={20} />
                  </button>

                  {/* BOTÓN CANCELAR */}
                  <button
                    onClick={() => handleCancelOrder(order.id)}
                    className="px-3 rounded-lg font-bold border transition-colors flex items-center justify-center bg-red-100 border-red-200 text-red-700 hover:bg-red-200"
                    title="Cancelar Pedido"
                  >
                    <XCircle size={20} />
                  </button>

                  {/* --- NUEVO BOTÓN WHATSAPP --- */}
                  <WhatsAppButton
                    type="DELIVERY"
                    order={{
                      id: order.ticket_number,
                      customerName: order.client?.name || 'Cliente',
                      phone: order.client?.phone || '',
                      total: order.total,
                      paymentMethod: order.payment_type || 'cash',
                      // Transformamos los items al formato que espera el botón
                      items: order.order_items.map((item: any) => ({
                        quantity: item.quantity,
                        name: item.product?.name || 'Item'
                      }))
                    }}
                  />

                  {/* BOTÓN LISTO */}
                  <button
                    onClick={() => handleCompleteOrder(order.id)}
                    className={`flex-1 py-3 rounded-lg font-bold text-white shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${isDemo ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    <CheckCircle size={18} /> {isDemo ? 'Despachar' : 'Listo'}
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