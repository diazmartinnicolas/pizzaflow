// src/utils/whatsapp.ts

// ⚙️ CONFIGURACIÓN: Tu Alias de MP
export const BUSINESS_ALIAS = "FLUXO.PAGOS.MP"; 

export interface OrderItem {
  quantity: number;
  name: string;
}

export interface WhatsAppData {
  phone: string;
  customerName: string;
  orderId: string | number;
  total: number;
  paymentMethod: 'cash' | 'transfer' | 'other' | 'card';
  items: OrderItem[];
}

export const getWhatsAppLink = (
  type: 'CONFIRMED' | 'DELIVERY', 
  data: WhatsAppData
): string => {
  const { phone, customerName, orderId, total, paymentMethod, items } = data;

  // 1. Limpieza de teléfono (Lógica Argentina)
  let cleanPhone = phone.replace(/\D/g, '');

  if (cleanPhone.length === 10) {
    cleanPhone = '549' + cleanPhone;
  } 
  else if (cleanPhone.length === 12 && cleanPhone.startsWith('54')) {
    cleanPhone = cleanPhone.replace('54', '549');
  }

  // 2. Armado del mensaje
  const itemsList = items
    .map(item => `- ${item.quantity}x ${item.name}`)
    .join('\n');

  let message = '';

  if (type === 'CONFIRMED') {
    message = `Hola ${customerName}! 👋\n`;
    message += `✅ *Tu pedido #${orderId} fue confirmado.*\n\n`;
    message += `📝 *Resumen:*\n${itemsList}\n\n`;

    if (paymentMethod === 'transfer') {
      message += `💸 Pago: Transferencia\n`;
      message += `Alias: ${BUSINESS_ALIAS}\n`;
    } else {
      const metodo = paymentMethod === 'card' ? 'Tarjeta' : 'Efectivo';
      message += `💵 Pago: ${metodo}\n`;
    }
    message += `Total: $${total.toLocaleString('es-AR')}\n\n`;
    message += `Te avisamos cuando salga el envio.`;
  } 
  else if (type === 'DELIVERY') {
    message = `Hola ${customerName}! 👋\n`;
    message += `🛵 *Tu pedido ya esta en camino.*\n\n`;
    message += `📦 *Llevamos:*\n${itemsList}\n\n`;
    message += `Gracias por elegirnos!`;
  }

  // 👇 EL CAMBIO CLAVE: Usamos el protocolo de APP
  return `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
};