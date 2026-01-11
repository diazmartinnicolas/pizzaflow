import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import { logAction } from '../services/audit';
import { Product, Order, Customer, Promotion, Profile } from '../types';

interface AppContextType {
  session: any;
  userProfile: Profile | null;
  loading: boolean;
  products: Product[];
  orders: Order[];
  customers: Customer[];
  promotions: Promotion[];
  refreshData: () => Promise<void>;
  signOut: () => Promise<void>;
  createOrder: (orderData: any, items: any[]) => Promise<any>;
  createCustomer: (customerData: any) => Promise<any>;
  toggleFavorite: (productId: string, currentStatus: boolean) => Promise<void>;
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
    try {
      const [prodRes, promoRes, clientRes, orderRes] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('promotions').select('*').is('deleted_at', null),
        supabase.from('clients').select('*').eq('is_active', true).order('name'),
        supabase.from('orders').select('*, clients(name)').order('created_at', { ascending: false }).limit(50)
      ]);

      if (prodRes.data) setProducts(prodRes.data);
      if (promoRes.data) setPromotions(promoRes.data);
      if (clientRes.data) setCustomers(clientRes.data);
      if (orderRes.data) setOrders(orderRes.data);
    } catch (err) {
      console.error("Error al refrescar datos:", err);
    }
  };

  const createOrder = async (orderData: any, items: any[]) => {
    // 1. Obtener la compañía (prioridad al perfil, luego a lo que venga en orderData)
    const companyId = userProfile?.company_id || orderData.company_id || (userProfile as any)?.companies?.id;

    // 2. Calcular el siguiente número de ticket para hoy (usando fecha local para el reset)
    const localDate = new Date();
    const today = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

    let nextTicket = 1;
    try {
      const { data: lastOrder } = await supabase
        .from('orders')
        .select('ticket_number')
        .eq('company_id', companyId)
        .gte('created_at', `${today}T00:00:00`)
        .order('ticket_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastOrder && lastOrder.ticket_number) {
        nextTicket = lastOrder.ticket_number + 1;
      }
    } catch (err) {
      console.error("Error calculando secuencia de ticket:", err);
      // Fallback a 1 si falla la consulta
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

    await logAction('VENTA', `Ticket #${order.ticket_number} - $${order.total}`, 'Caja');
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

  return (
    <AppContext.Provider value={{
      session,
      userProfile,
      loading,
      products,
      orders,
      customers,
      promotions,
      refreshData,
      signOut,
      createOrder,
      createCustomer,
      toggleFavorite
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