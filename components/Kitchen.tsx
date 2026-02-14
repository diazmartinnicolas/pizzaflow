import { useEffect, useState, useRef, forwardRef } from 'react';
import { supabase } from '../services/supabase';
import { useReactToPrint } from 'react-to-print';
import { CheckCircle, Clock, RefreshCw, ChefHat, XCircle, Printer, Edit } from 'lucide-react';
// IMPORTAMOS EL BOTÓN NUEVO
import { WhatsAppButton } from './WhatsAppButton';

// --- COMPONENTE TICKET TÉRMICO (Visible solo al imprimir) ---
const KitchenTicket = forwardRef<HTMLDivElement, { order: any; companyName?: string }>(({ order, companyName }, ref) => {
  if (!order) return null;

  const paymentMethod = order.payment_type ? order.payment_type.toUpperCase() : 'EFECTIVO';

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
    <div ref={ref} className="hidden print:block p-2 bg-white text-black font-mono text-[12px] w-[58mm] mx-auto leading-normal">
      <style>{`
        @page { 
          margin: 0; 
          size: 58mm auto;
        }
        @media print {
          body { 
            margin: 0; 
            padding: 0;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>

      {/* Header */}
      <div className="text-center mb-2">
        <h2 className="font-bold text-base uppercase leading-tight">
          {companyName || 'FLUXO'}
        </h2>
        <p className="text-[10px]">
          {new Date().toLocaleDateString('es-AR')} - {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      <div className="border-b-[1px] border-black border-double mb-2"></div>

      {/* Ticket Number */}
      <div className="flex justify-between font-bold text-sm mb-1 uppercase">
        <span>TICKET:</span>
        <span>#{order.ticket_number}</span>
      </div>

      <div className="border-b border-black border-dashed mb-1"></div>

      {/* Type & Payment Info */}
      <div className="mb-1 text-sm font-bold uppercase">
        {order.order_type === 'delivery' ? '[DELIVERY]' : order.order_type === 'takeaway' ? '[P/LLEVAR]' : '[MESA]'}
        {' '}[{paymentMethod}]
      </div>

      <div className="border-b-[1px] border-black border-double mb-2"></div>

      {/* Table info */}
      {order.table && (
        <div className="mb-2">
          <p className="font-bold uppercase">MESA: {order.table.name || order.table.id}</p>
          <div className="border-b border-black border-dashed mt-1"></div>
        </div>
      )}

      {/* Cliente / Dirección */}
      <div className="text-xs uppercase mb-2">
        <p className="font-bold">CLIENTE / DIRECCION:</p>
        <p className="text-sm font-black">{order.client?.name || 'Mostrador'}</p>

        {order.order_type === 'delivery' && order.delivery_address ? (
          <p className="text-xs mt-0.5 font-bold leading-tight">📍 {order.delivery_address}</p>
        ) : (
          <p className="text-xs mt-0.5 font-bold leading-tight">{order.client?.address || 'Retira en local'}</p>
        )}

        {(order.delivery_phone || order.client?.phone) && (
          <div className="mt-1">
            <p className="font-bold">TELEFONO:</p>
            <p className="text-sm">{order.delivery_phone || order.client?.phone}</p>
          </div>
        )}
      </div>

      <div className="border-b-[1px] border-black border-double mb-2"></div>

      {/* Items */}
      <div className="mb-2">
        <ul className="space-y-2">
          {sortedItems.map((item: any, index: number) => (
            <li key={index} className="flex flex-col">
              <div className="flex gap-1 items-start">
                <span className="font-black text-sm">{item.quantity}</span>
                <span className="mx-0.5">x</span>
                <span className="flex-1 text-sm font-black uppercase">
                  {item.item_name || item.product?.name}
                </span>
              </div>
              {item.notes && (
                <span className="text-[10px] ml-6 italic block leading-tight">
                  ({item.notes})
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="border-b-[1px] border-black border-double mb-2 mt-2"></div>

      {/* Total */}
      <div className="flex justify-between items-center py-1 font-black text-base">
        <span>TOTAL:</span>
        <span>${Number(order.total || 0).toLocaleString('es-AR')}</span>
      </div>

      <div className="border-b-[1px] border-black border-double mb-3"></div>

      {/* Observaciones */}
      <div className="mb-4">
        <p className="text-[10px] font-bold mb-1">OBSERVACIONES:</p>
        <div className="w-full h-16 border border-black border-dashed rounded flex"></div>
      </div>

      <div className="border-b border-black border-dashed mb-2"></div>

      <div className="text-center font-bold text-[10px] mt-2 pb-8">
        <p>*** FIN DE ORDEN ***</p>
      </div>
    </div>
  );
});

interface KitchenProps {
  demoOrders?: any[];
  onDemoComplete?: (id: any) => void;
  onEditOrder?: (order: any) => void;
  companyName?: string;
}

export default function Kitchen({ demoOrders = [], onDemoComplete, onEditOrder, companyName }: KitchenProps) {
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
                product_id,
                quantity,
                price_at_moment,
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
                      {/* Badge de tipo de pedido */}
                      {order.order_type && order.order_type !== 'local' && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${order.order_type === 'delivery'
                          ? 'bg-blue-500 text-white'
                          : 'bg-amber-500 text-white'
                          }`}>
                          {order.order_type === 'delivery' ? '🛵 Delivery' : '🏃 Llevar'}
                        </span>
                      )}
                    </h3>
                    <p className={`text-xs font-medium truncate w-32 md:w-40 ${isDemo ? 'text-orange-800' : 'text-gray-500'}`}>
                      {order.client?.name || 'Cliente Mostrador'}
                    </p>
                    {/* Mostrar dirección de delivery si existe */}
                    {order.order_type === 'delivery' && order.delivery_address && (
                      <p className="text-[10px] text-blue-600 font-medium truncate w-40">
                        📍 {order.delivery_address}
                      </p>
                    )}
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
                <div className={`p-2 border-t flex flex-wrap gap-1.5 items-center ${isDemo ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'}`}>

                  {/* BOTÓN IMPRIMIR */}
                  <button
                    onClick={() => onPrintClick(order)}
                    className="p-2 rounded-lg font-bold border transition-colors flex items-center justify-center flex-shrink-0 bg-gray-100 border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                    title="Imprimir Comanda"
                  >
                    <Printer size={18} />
                  </button>

                  {/* BOTÓN EDITAR */}
                  {order.status === 'pendiente' && (
                    <button
                      onClick={() => onEditOrder?.(order)}
                      className="p-2 rounded-lg font-bold border transition-colors flex items-center justify-center flex-shrink-0 bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                      title="Editar Pedido"
                    >
                      <Edit size={18} />
                    </button>
                  )}

                  {/* BOTÓN CANCELAR */}
                  <button
                    onClick={() => handleCancelOrder(order.id)}
                    className="p-2 rounded-lg font-bold border transition-colors flex items-center justify-center flex-shrink-0 bg-red-100 border-red-200 text-red-700 hover:bg-red-200"
                    title="Cancelar Pedido"
                  >
                    <XCircle size={18} />
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
                    className={`flex-1 min-w-[80px] py-2 rounded-lg font-bold text-white shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm ${isDemo ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    <CheckCircle size={16} /> {isDemo ? 'Despachar' : 'Listo'}
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