import { MessageCircle, Send } from 'lucide-react';
import { getWhatsAppLink } from '../utils/whatsapp';

interface WhatsAppButtonProps {
  type: 'CONFIRMED' | 'DELIVERY';
  order: {
    phone: string;
    customerName: string;
    id: string | number;
    total: number;
    paymentMethod: 'cash' | 'transfer' | 'other' | 'card';
    items: { quantity: number; name: string }[];
  };
  className?: string;
}

export const WhatsAppButton = ({ type, order, className = '' }: WhatsAppButtonProps) => {

  const handleClick = () => {
    // Validación simple
    if (!order.phone) return alert("⚠️ El cliente no tiene teléfono cargado.");
    
    // Generamos el link con protocolo whatsapp://
    const link = getWhatsAppLink(type, {
        phone: order.phone,
        customerName: order.customerName,
        orderId: order.id,
        total: order.total,
        paymentMethod: order.paymentMethod,
        items: order.items
    });

    // 👇 LA ACCIÓN DIRECTA
    // Al asignar el link a window.location.href, el navegador intenta abrir la aplicación externa.
    // No abre pestaña nueva, solo dispara la app.
    window.location.href = link;
  };

  const isDelivery = type === 'DELIVERY';

  return (
    <button
      onClick={handleClick}
      className={`
        flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-bold shadow-sm transition-all
        ${isDelivery 
          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
          : 'bg-green-600 hover:bg-green-700 text-white'
        }
        ${className} 
      `}
      title={isDelivery ? "Avisar que salió" : "Confirmar pedido por WP"}
    >
      {isDelivery ? <Send size={18} /> : <MessageCircle size={18} />}
      <span className="text-sm hidden xl:inline">
        {isDelivery ? 'Avisar Salida' : 'WhatsApp'}
      </span>
    </button>
  );
};