import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { logAction } from '../services/audit';
import { Product, Order, Customer, Promotion, Profile } from '../types';
import {
  saveToStore,
  getAllFromStore,
  savePendingOrder,
  getPendingOrders,
  removePendingOrder,
  updatePendingOrderStatus,
  countPendingOrders
} from '../services/offlineStorage';

interface AppContextType {
  session: any;
  userProfile: Profile | null;
  loading: boolean;
  products: Product[];
  orders: Order[];
  customers: Customer[];
  promotions: Promotion[];
  isOnline: boolean;
  pendingOrdersCount: number;
  refreshData: () => Promise<void>;
  signOut: () => Promise<void>;
  createOrder: (orderData: any, items: any[]) => Promise<any>;
  updateOrder: (orderId: string | number, orderData: any, items: any[]) => Promise<any>;
  createCustomer: (customerData: any) => Promise<any>;
  toggleFavorite: (productId: string, currentStatus: boolean) => Promise<void>;
  syncPendingOrders: () => Promise<number>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  // Estado offline
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        setUserProfile(null);
        setProducts([]);
        setOrders([]);
        setCustomers([]);
        setPromotions([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Monitorear estado de conexión
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      // Intentar sincronizar pedidos pendientes cuando vuelve la conexión
      const count = await countPendingOrders();
      if (count > 0) {
        console.log('[Offline] Conexión restaurada, hay', count, 'pedidos pendientes');
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Contar pedidos pendientes al iniciar
    countPendingOrders().then(setPendingOrdersCount);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`*, companies(*)`)
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setUserProfile(data);
      if (data) await refreshData();
    } catch (err) {
      console.error("Error al cargar perfil:", err);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    // Si está offline, cargar datos desde cache
    if (!navigator.onLine) {
      console.log('[Offline] Cargando datos desde cache...');
      try {
        const [cachedProducts, cachedCustomers, cachedPromotions] = await Promise.all([
          getAllFromStore<Product>('products'),
          getAllFromStore<Customer>('customers'),
          getAllFromStore<Promotion>('promotions')
        ]);

        if (cachedProducts.length > 0) setProducts(cachedProducts);
        if (cachedCustomers.length > 0) setCustomers(cachedCustomers);
        if (cachedPromotions.length > 0) setPromotions(cachedPromotions);

        console.log('[Offline] Datos cargados desde cache:', {
          products: cachedProducts.length,
          customers: cachedCustomers.length,
          promotions: cachedPromotions.length
        });
      } catch (err) {
        console.error('[Offline] Error cargando datos desde cache:', err);
      }
      return;
    }

    // Si está online, cargar desde Supabase y cachear
    try {
      const [prodRes, promoRes, clientRes, orderRes] = await Promise.all([
        supabase.from('products').select('*').is('deleted_at', null).order('name'),
        supabase.from('promotions').select('*').is('deleted_at', null),
        supabase.from('clients').select('*').eq('is_active', true).order('name'),
        supabase.from('orders').select('*, clients(name)').order('created_at', { ascending: false }).limit(50)
      ]);

      if (prodRes.data) {
        setProducts(prodRes.data);
        // Cachear para uso offline
        saveToStore('products', prodRes.data).catch(console.error);
      }
      if (promoRes.data) {
        setPromotions(promoRes.data);
        saveToStore('promotions', promoRes.data).catch(console.error);
      }
      if (clientRes.data) {
        setCustomers(clientRes.data);
        saveToStore('customers', clientRes.data).catch(console.error);
      }
      if (orderRes.data) setOrders(orderRes.data);

      console.log('[Online] Datos cargados y cacheados');
    } catch (err) {
      console.error("Error al refrescar datos:", err);
    }
  };

  const createOrder = async (orderData: any, items: any[]) => {
    // Si está offline, guardar pedido localmente
    if (!navigator.onLine) {
      console.log('[Offline] Guardando pedido localmente...');
      const pendingId = await savePendingOrder(orderData, items);
      const count = await countPendingOrders();
      setPendingOrdersCount(count);
      console.log('[Offline] Pedido guardado con ID:', pendingId);
      return { id: pendingId, ticket_number: 'OFFLINE', offline: true };
    }

    // 1. Obtener la compañía (prioridad al perfil, luego a lo que venga en orderData)
    const companyId = userProfile?.company_id || orderData.company_id || (userProfile as any)?.companies?.id;

    // 2. Calcular el siguiente número de ticket para hoy (usando fecha local para el reset)
    const localDate = new Date();
    const today = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

    let nextTicket = 1;
    try {
      // Usamos count para saber cuántos pedidos van HOY y así resetear a #1, #2... 
      // incluso si hay números altos previos.
      const { count, error: seqErr } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', `${today}T00:00:00`);

      if (seqErr) throw seqErr;
      nextTicket = (count || 0) + 1;

      console.log(`[Ticket Logic] Empresa: ${companyId}, Hoy: ${today}, Pedidos previos: ${count}, Siguiente: ${nextTicket}`);
    } catch (err) {
      console.error("Error calculando secuencia de ticket:", err);
      nextTicket = Math.floor(Date.now() / 1000) % 10000;
    }

    // 3. Insertar con el número calculado y asegurando el company_id
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert([{
        ...orderData,
        ticket_number: nextTicket,
        company_id: companyId
      }])
      .select()
      .single();

    if (orderErr) throw orderErr;

    const orderItems = items.map(item => ({
      ...item,
      order_id: order.id
    }));

    const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
    if (itemsErr) throw itemsErr;

    const typeLabels: Record<string, string> = { local: 'Mesa', takeaway: 'Take Away', delivery: 'Delivery' };
    const typeLabel = typeLabels[orderData.order_type] || orderData.order_type || '';
    await logAction('VENTA', `Ticket #${order.ticket_number} - $${order.total} (${typeLabel} · ${orderData.payment_type || 'N/A'})`, 'Caja');
    await refreshData();
    return order;
  };

  const updateOrder = async (orderId: string | number, orderData: any, items: any[]) => {
    // 1. Actualizar el pedido principal
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .update(orderData)
      .eq('id', orderId)
      .select()
      .single();

    if (orderErr) throw orderErr;

    // 2. Eliminar items anteriores e insertar los nuevos
    // (Es la forma más sencilla de manejar ediciones complejas)
    const { error: delErr } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);

    if (delErr) throw delErr;

    const orderItems = items.map(item => ({
      ...item,
      order_id: orderId
    }));

    const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
    if (itemsErr) throw itemsErr;

    const typeLabels: Record<string, string> = { local: 'Mesa', takeaway: 'Take Away', delivery: 'Delivery' };
    const typeLabel = typeLabels[orderData.order_type] || orderData.order_type || '';
    await logAction('VENTA', `EDITADO: Ticket #${order.ticket_number} - $${order.total} (${typeLabel} · ${orderData.payment_type || 'N/A'})`, 'Caja');
    await refreshData();
    return order;
  };

  const createCustomer = async (customerData: any) => {
    const { data, error } = await supabase
      .from('clients')
      .insert([customerData])
      .select()
      .single();

    if (error) throw error;
    await logAction('CREAR_CLIENTE', `Rápido: ${data.name}`, 'Clientes');
    await refreshData();
    return data;
  };

  const toggleFavorite = async (productId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_favorite: newStatus } : p));

    const { error } = await supabase
      .from('products')
      .update({ is_favorite: newStatus })
      .eq('id', productId);

    if (error) {
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_favorite: currentStatus } : p));
      throw error;
    }
  };

  const signOut = async () => {
    await logAction('LOGOUT', 'Sesión cerrada', 'Sistema');
    await supabase.auth.signOut();
  };

  // Sincronizar pedidos pendientes cuando vuelve la conexión
  const syncPendingOrders = async (): Promise<number> => {
    if (!navigator.onLine) {
      console.log('[Offline] No hay conexión para sincronizar');
      return 0;
    }

    const pendingOrders = await getPendingOrders();
    const toSync = pendingOrders.filter(o => o.syncStatus === 'pending');

    if (toSync.length === 0) return 0;

    console.log(`[Offline] Sincronizando ${toSync.length} pedidos pendientes...`);
    let synced = 0;

    for (const order of toSync) {
      try {
        await updatePendingOrderStatus(order.id, 'syncing');

        // Recrear pedido online (sin el check de offline en createOrder)
        const companyId = userProfile?.company_id || order.orderData.company_id || (userProfile as any)?.companies?.id;
        const localDate = new Date();
        const today = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

        const { count } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gte('created_at', `${today}T00:00:00`);

        const nextTicket = (count || 0) + 1;

        const { data: createdOrder, error: orderErr } = await supabase
          .from('orders')
          .insert([{
            ...order.orderData,
            ticket_number: nextTicket,
            company_id: companyId
          }])
          .select()
          .single();

        if (orderErr) throw orderErr;

        const orderItems = order.orderItems.map(item => ({
          ...item,
          order_id: createdOrder.id
        }));

        const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
        if (itemsErr) throw itemsErr;

        await logAction('VENTA', `Ticket #${createdOrder.ticket_number} (offline sync) - $${createdOrder.total}`, 'Caja');
        await removePendingOrder(order.id);
        synced++;

        console.log(`[Offline] Pedido ${order.id} sincronizado como #${createdOrder.ticket_number}`);
      } catch (err: any) {
        await updatePendingOrderStatus(order.id, 'error', err.message);
        console.error(`[Offline] Error sincronizando pedido ${order.id}:`, err);
      }
    }

    const newCount = await countPendingOrders();
    setPendingOrdersCount(newCount);

    if (synced > 0) await refreshData();

    return synced;
  };

  return (
    <AppContext.Provider value={{
      session,
      userProfile,
      loading,
      products,
      orders,
      customers,
      promotions,
      isOnline,
      pendingOrdersCount,
      refreshData,
      signOut,
      createOrder,
      updateOrder,
      createCustomer,
      toggleFavorite,
      syncPendingOrders
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};