// src/services/demo.ts
import { supabase } from './supabase';

export const resetDemoData = async (userId: string) => {
  try {
    console.log("🔄 Iniciando reseteo de Demo...");

    // 1. LIMPIEZA TOTAL
    await Promise.all([
      supabase.from('order_items').delete().eq('user_id', userId),
      supabase.from('orders').delete().eq('user_id', userId),
      supabase.from('products').delete().eq('user_id', userId),
      supabase.from('clients').delete().eq('user_id', userId),
      supabase.from('reservations').delete().eq('user_id', userId)
    ]);

    // 2. CREAR PRODUCTOS
    const { data: products } = await supabase.from('products').insert([
      { user_id: userId, name: 'Pizza Muzzarella', category: 'Pizzas', price: 12000, active: true, is_favorite: true },
      { user_id: userId, name: 'Pizza Napolitana', category: 'Pizzas', price: 13500, active: true },
      { user_id: userId, name: 'Hamburguesa Completa', category: 'Hamburguesas', price: 9500, active: true },
      { user_id: userId, name: 'Papas Fritas', category: 'Guarniciones', price: 4500, active: true },
      { user_id: userId, name: 'Cerveza Andes 1L', category: 'Bebidas', price: 4000, active: true },
      { user_id: userId, name: 'Coca Cola 1.5L', category: 'Bebidas', price: 3500, active: true },
    ]).select();

    // 3. CREAR CLIENTES (Con Cumpleaños Dinámico 🎂)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    await supabase.from('clients').insert([
      { 
        user_id: userId, 
        name: 'Martín (Cumpleañero)', 
        address: 'Av. Siempre Viva 123', 
        phone: '5491122334455', 
        birth_date: todayStr, // Cumple hoy
        is_active: true 
      },
      { 
        user_id: userId, 
        name: 'Mauro Petriella', 
        address: 'Calle Falsa 123', 
        phone: '5491155667788', 
        birth_date: '1995-05-20', 
        is_active: true 
      }
    ]);

    // 4. CREAR RESERVAS (Corregido)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    await supabase.from('reservations').insert([
      { 
        user_id: userId, 
        client_name: 'Familia Pérez', 
        date: tomorrowStr, 
        time: '21:00', 
        pax: 4, 
        phone: '5491122334455',       
        status: 'pendiente', 
        notes: 'Mesa cerca de la ventana' 
      },
      { 
        user_id: userId, 
        client_name: 'Reunión Amigos', 
        date: todayStr, 
        time: '22:30', 
        pax: 6,                        
        phone: '5491155667788',        
        status: 'confirmada', 
        notes: '' 
      }
    ]);

    // 5. CREAR PEDIDO
    if (products && products.length > 0) {
      const { data: order } = await supabase.from('orders').insert([
        { user_id: userId, customer_name: 'Mesa 5', status: 'pending', total: 25500, payment_method: 'cash' }
      ]).select().single();

      if (order) {
        await supabase.from('order_items').insert([
          { order_id: order.id, user_id: userId, product_id: products[0].id, quantity: 1, price: 12000, name: products[0].name },
          { order_id: order.id, user_id: userId, product_id: products[1].id, quantity: 1, price: 13500, name: products[1].name }
        ]);
      }
    }
    return true;
  } catch (error) {
    console.error("❌ Error en resetDemoData:", error);
    throw error;
  }
};