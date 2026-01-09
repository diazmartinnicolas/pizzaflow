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

  // Limpieza de teléfono
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = '549' + cleanPhone;
  else if (cleanPhone.length === 12 && cleanPhone.startsWith('54')) cleanPhone = cleanPhone.replace('54', '549');

  // Armado del mensaje de PEDIDOS
  const itemsList = items.map(item => `- ${item.quantity}x ${item.name}`).join('\n');
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

  return `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
};

// 👇 AQUÍ ESTÁ LA CORRECCIÓN DE LA FECHA PARA RESERVAS
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

  // 2. FORMATEO MANUAL DE FECHA (Sin Zonas Horarias) 🛡️
  // Si la fecha viene como "2026-01-12" o "2026-01-12T00:00:00"
  
  let dateOnly = date;
  // Si tiene la "T" de tiempo, la cortamos
  if (date.includes('T')) {
    dateOnly = date.split('T')[0];
  }

  // Cortamos el string por los guiones: ["2026", "01", "12"]
  const parts = dateOnly.split('-');
  
  // Reordenamos: Día/Mes/Año
  // parts[2] es día, parts[1] es mes, parts[0] es año
  const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`; 

  let message = `Hola ${customerName}! 👋\n`;
  message += `✅ *Confirmamos tu reserva.*\n\n`;
  message += `📅 Fecha: ${formattedDate}\n`;
  message += `⏰ Hora: ${time} hs\n`;
  message += `👥 Personas: ${pax}\n\n`;
  message += `📍 Te esperamos!`;

  return `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
};

// 👇 NUEVA FUNCIÓN PARA CUMPLEAÑOS
export const getBirthdayLink = (data: { 
  customerName: string; 
  phone: string; 
  discountText?: string; // Ej: "20% OFF" o "una bebida de regalo"
}): string => {
  const { customerName, phone, discountText = "un regalo especial" } = data;

  // Limpieza de teléfono
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = '549' + cleanPhone;
  else if (cleanPhone.length === 12 && cleanPhone.startsWith('54')) cleanPhone = cleanPhone.replace('54', '549');

  let message = `¡Feliz Cumpleaños ${customerName}! 🎂🎈\n\n`;
  message += `Queremos festejar con vos en tu día.\n`;
  message += `🎁 Tenés *${discountText}* para usar hoy en tu pedido.\n\n`;
  message += `¡Esperamos que pases un día genial! 🥂`;

  return `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
};