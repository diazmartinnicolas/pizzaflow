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

// 👇 NUEVA FUNCIÓN PARA RESERVAS
export const getReservationLink = (data: { 
  customerName: string; 
  date: string; 
  time: string; 
  pax: number; 
  phone: string; 
}): string => {
  const { customerName, date, time, pax, phone } = data;

  // 1. Limpieza de teléfono
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = '549' + cleanPhone;
  else if (cleanPhone.length === 12 && cleanPhone.startsWith('54')) cleanPhone = cleanPhone.replace('54', '549');

  // 2. Armado del mensaje
  // Formateamos la fecha para que se vea bonita (ej: 2024-02-20 -> 20/02/2024)
  const formattedDate = new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

  let message = `Hola ${customerName}! 👋\n`;
  message += `✅ *Confirmamos tu reserva.*\n\n`;
  message += `📅 Fecha: ${formattedDate}\n`;
  message += `⏰ Hora: ${time} hs\n`;
  message += `👥 Personas: ${pax}\n\n`;
  message += `📍 Te esperamos!`;

  return `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
};