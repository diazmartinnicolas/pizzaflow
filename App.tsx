import { useEffect, useState, useRef, useMemo } from 'react';
import { z } from 'zod';
import { useApp } from './context/AppContext';
import { Login } from './components/Login';
import Kitchen from './components/Kitchen';
import Inventory from './components/Inventory';
import Customers from './components/Customers';
import Promotions from './components/Promotions';
import Users from './components/Users';
import History from './components/History';
import Reservations from './components/Reservations';
import Reports from './components/Reports';
import { calculateHalfHalfPrice } from './utils/pricing';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { StatusOverlay } from './components/ui/StatusOverlay';

// Iconos
import {
  ShoppingCart, ChefHat, Users as UsersIcon, Package, Percent,
  History as HistoryIcon, UserCog, LogOut, Search, CalendarClock, Menu, Receipt,
  LayoutDashboard, Monitor, Crown, BarChart3, Briefcase, Tag,
  Building2, Flame, Trash2, Banknote, QrCode, CreditCard, MapPin, Phone, Star, Split, X, Plus, Minus, UserPlus
} from 'lucide-react';

// Esquema de validación para clientes
const clientSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  address: z.string().min(5, "La dirección es muy corta"),
  phone: z.string().regex(/^\+?[0-9\s-]{8,20}$/, "Formato de teléfono inválido")
});

function App() {
  const {
    session, userProfile, loading, products, customers, promotions,
    signOut, createOrder, createCustomer, toggleFavorite
  } = useApp();

  // Navegación
  const [activeTab, setActiveTab] = useState('pos');
  const [selectedCategory, setSelectedCategory] = useState('Todo');
  const [mobileView, setMobileView] = useState('products');

  // Estados locales de UI
  const [cart, setCart] = useState<any[]>([]);
  const [demoOrders, setDemoOrders] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [newClientData, setNewClientData] = useState({ name: '', address: '', phone: '' });
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [paymentType, setPaymentType] = useState('efectivo');
  const [firstHalf, setFirstHalf] = useState<any>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); setActiveTab('pos'); }
      if (e.key === 'F2') { e.preventDefault(); setActiveTab('kitchen'); }
      if (e.key === 'F3') { e.preventDefault(); setActiveTab('customers'); }
      if (e.key === 'F4') { e.preventDefault(); setActiveTab('reservations'); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Derivados de permisos
  const isDemo = session?.user?.email?.toLowerCase().includes('demo');
  const isSuperAdmin = userProfile?.role === 'super_admin' || session?.user?.email === 'diazmartinnicolas@gmail.com';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin || isDemo;
  const companyName = userProfile?.companies?.name || (isDemo ? 'Modo Demo' : 'Fluxo');

  const categories = ['Todo', 'Promociones', 'Pizzas', 'Milanesas', 'Hamburguesas', 'Empanadas', 'Ensaladas', 'Mitades', 'Bebidas', 'Postres'];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Limpieza al cambiar de sesión
  useEffect(() => {
    setCart([]);
    setSelectedCustomerId('');
    setClientSearchTerm('');
    setMobileView('products');
    console.log("♻️ Sesión sincronizada.");
  }, [session?.user?.id]);

  const getRoleLabel = () => {
    if (isDemo) return 'Usuario Demo';
    const roles: any = { super_admin: 'CEO', admin: 'Administrador', cashier: 'Cajero', cocina: 'Cocina' };
    const label = roles[userProfile?.role || ''] || 'Usuario';
    return isSuperAdmin ? label : `${label} (${companyName})`;
  };

  const handleToggleFavorite = async (productId: string) => {
    // Optimístico: Ya está manejado en AppContext pero podemos agregar un feedback visual aquí si quisiéramos
    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      await toggleFavorite(productId, product.is_favorite);
    } catch (error: any) {
      toast.error("Error al marcar favorito");
    }
  };

  const addToCart = (product: any) => {
    setCart(current => [...current, { ...product, cartId: Date.now() + Math.random() }]);
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const calculateTotals = () => {
    let tempCart = [...cart];
    let appliedDiscounts: any[] = [];
    let subtotal = cart.reduce((sum, item) => sum + item.price, 0);

    promotions.forEach(promo => {
      let guard = 0;
      while (guard < 50) {
        guard++;
        const idx1 = tempCart.findIndex(item => item.id === promo.product_1_id);
        if (idx1 === -1) break;
        if (promo.product_2_id) {
          const idx2 = tempCart.findIndex((item, i) => item.id === promo.product_2_id && i !== idx1);
          if (idx2 !== -1) {
            appliedDiscounts.push({ name: promo.name, amount: (tempCart[idx1].price + tempCart[idx2].price) * (promo.discount_percentage / 100) });
            const ids = [tempCart[idx1].cartId, tempCart[idx2].cartId];
            tempCart = tempCart.filter(item => !ids.includes(item.cartId));
          } else break;
        } else {
          const is2x1 = promo.type === '2x1' || promo.name.toLowerCase().includes('2x1');
          if (is2x1) {
            const idx2 = tempCart.findIndex((item, i) => item.id === promo.product_1_id && i !== idx1);
            if (idx2 !== -1) {
              appliedDiscounts.push({ name: promo.name, amount: (tempCart[idx1].price + tempCart[idx2].price) * (promo.discount_percentage / 100) });
              const ids = [tempCart[idx1].cartId, tempCart[idx2].cartId];
              tempCart = tempCart.filter(item => !ids.includes(item.cartId));
            } else break;
          } else {
            appliedDiscounts.push({ name: promo.name, amount: tempCart[idx1].price * (promo.discount_percentage / 100) });
            const id = tempCart[idx1].cartId;
            tempCart = tempCart.filter(item => item.cartId !== id);
          }
        }
      }
    });

    const totalDiscount = appliedDiscounts.reduce((sum, d) => sum + d.amount, 0);
    return { subtotal, totalDiscount, finalTotal: subtotal - totalDiscount, appliedDiscounts };
  };

  const { finalTotal, appliedDiscounts } = calculateTotals();

  const groupedCart = useMemo(() => Object.values(cart.reduce((acc: any, item: any) => {
    if (!acc[item.id]) acc[item.id] = { ...item, quantity: 0, subtotalPrice: 0 };
    acc[item.id].quantity += 1;
    acc[item.id].subtotalPrice += item.price;
    return acc;
  }, {})), [cart]);

  const handleCheckout = async () => {
    if (cart.length === 0 || !selectedCustomerId) return;
    setIsProcessing(true);

    if (isDemo) {
      setTimeout(() => {
        // Lógica de ticket secuencial para Demo (simulada)
        const todayKey = `fluxo_demo_ticket_${new Date().toISOString().split('T')[0]}`;
        const lastTicket = parseInt(localStorage.getItem(todayKey) || '0');
        const nextTicket = lastTicket + 1;
        localStorage.setItem(todayKey, nextTicket.toString());

        setDemoOrders(prev => [{
          id: Date.now(),
          ticket_number: nextTicket,
          created_at: new Date().toISOString(),
          status: 'pendiente',
          client: { name: clientSearchTerm },
          order_items: cart.map(i => ({ product: { name: i.name }, quantity: 1 }))
        }, ...prev]);
        setCart([]); setSelectedCustomerId(''); setClientSearchTerm(''); setMobileView('products'); setIsProcessing(false);
      }, 600);
      return;
    }

    try {
      await createOrder({
        client_id: selectedCustomerId,
        total: finalTotal,
        payment_type: paymentType,
        user_id: session.user.id
      }, groupedCart.map((item: any) => ({
        product_id: item.id.toString().startsWith('combo-') ? (products.find(p => p.category === 'Pizzas')?.id || products[0]?.id) : item.id,
        quantity: item.quantity,
        price_at_moment: item.price
      })));
      setCart([]); setSelectedCustomerId(''); setClientSearchTerm(''); setMobileView('products');
      toast.success("¡Pedido enviado con éxito!");
    } catch (err: any) {
      toast.error("Error al procesar pedido: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickCustomerCreate = async () => {
    const result = clientSchema.safeParse(newClientData);
    if (!result.success) {
      setFormError(result.error.issues[0].message);
      return;
    }
    setFormError(null);

    try {
      const data = await createCustomer({ ...newClientData, user_id: session.user.id });
      setSelectedCustomerId(data.id);
      setClientSearchTerm(data.name);
      setShowQuickCustomer(false);
      setNewClientData({ name: '', address: '', phone: '' });
      toast.success(`Cliente ${data.name} registrado`);
    } catch (error: any) {
      toast.error("Error creando cliente: " + error.message);
    }
  };

  if (loading) return (
    <div className="h-dvh flex flex-col items-center justify-center bg-gray-50">
      <Flame className="w-12 h-12 text-orange-500 animate-spin opacity-50 mb-4" />
      <div className="text-orange-600 font-bold animate-pulse">Cargando Fluxo...</div>
    </div>
  );

  if (!session) return <Login />;

  const filteredProducts = products
    .filter(p => selectedCategory === 'Todo' || (selectedCategory === 'Mitades' ? (p.category === 'Mitades' || p.name.toLowerCase().includes('mitad')) : p.category === selectedCategory))
    .sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()));

  // Bloqueo por Suspensión de Servicio (SaaS Control)
  const isCompanyInactive = userProfile?.companies?.status === 'inactive';
  const shouldBlockAccess = isCompanyInactive && !isSuperAdmin;

  if (shouldBlockAccess) {
    return <StatusOverlay companyName={companyName} onSignOut={signOut} />;
  }

  return (
    <div className="flex h-dvh bg-gray-50 font-sans text-gray-800 overflow-hidden">
      <Toaster position="top-right" richColors />
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-200 flex-col justify-between hidden md:flex z-50">
        <div>
          <div className="p-5 pb-2">
            <div className="flex items-center gap-3 mb-5"><Flame className="w-6 h-6 text-orange-600" /><h1 className="text-xl font-bold tracking-tight">Fluxo</h1></div>
            <div className={`p-3 rounded-xl border mb-2 shadow-sm ${isDemo ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'}`}>
              <span className="text-[10px] font-extrabold text-gray-400 uppercase">{isDemo ? 'MODO VISITA' : 'TU ROL'}</span>
              <div className="flex items-center gap-1.5 mt-1">
                {isSuperAdmin ? <Crown className="w-3.5 h-3.5 text-yellow-500" /> : <Briefcase className="w-3.5 h-3.5 text-blue-500" />}
                <span className="text-sm font-bold truncate">{getRoleLabel()}</span>
              </div>
            </div>
          </div>
          <nav className="px-3 space-y-1">
            <SidebarItem icon={<ShoppingCart size={20} />} label="Ventas" active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} shortcut="F1" />
            <SidebarItem icon={<ChefHat size={20} />} label="Cocina" active={activeTab === 'kitchen'} onClick={() => setActiveTab('kitchen')} shortcut="F2" />
            <SidebarItem icon={<UsersIcon size={20} />} label="Clientes" active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} shortcut="F3" />
            <SidebarItem icon={<CalendarClock size={20} />} label="Reservas" active={activeTab === 'reservations'} onClick={() => setActiveTab('reservations')} shortcut="F4" />
            {isAdmin && (
              <>
                <div className="h-px bg-gray-100 my-4"></div>
                <SidebarItem
                  icon={isSuperAdmin ? <Building2 size={20} /> : <UserCog size={20} />}
                  label={isSuperAdmin ? "Panel Negocios" : "Personal"}
                  active={activeTab === (isSuperAdmin ? 'clients' : 'users')}
                  onClick={() => setActiveTab(isSuperAdmin ? 'clients' : 'users')}
                />
                <SidebarItem icon={<Package size={20} />} label="Inventario" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
                <SidebarItem icon={<HistoryIcon size={20} />} label="Historial" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
                <SidebarItem icon={<BarChart3 size={20} />} label="Reportes" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
              </>
            )}
          </nav>
        </div>
        <div className="p-4 border-t"><button onClick={signOut} className="flex items-center justify-center gap-2 w-full p-2.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all font-medium text-sm border border-gray-100"><LogOut size={18} /> Salir</button></div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b flex items-center justify-between px-4 z-40">
        <button onClick={() => setShowMobileMenu(true)}><Menu /></button>
        <div className="flex items-center gap-2 text-orange-600 font-bold"><Flame size={20} /> Fluxo</div>
        <div className="w-6"></div>
      </div>

      {/* CONTENT */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative pt-16 md:pt-0">
        {activeTab === 'pos' && (
          <div className="flex h-full flex-col md:flex-row">
            <div className={`flex-1 overflow-y-auto p-4 md:p-6 ${mobileView === 'cart' ? 'hidden md:block' : 'block'}`}>
              <header className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
                {categories.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-orange-600 text-white shadow-md' : 'bg-white border text-gray-600'}`}>{cat}</button>
                ))}
              </header>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-24">
                {selectedCategory !== 'Promociones' && filteredProducts.map(product => (
                  <div key={product.id} onClick={() => {
                    const isHalf = product.category === 'Mitades' || product.name.toLowerCase().includes('mitad');
                    if (!isHalf) return addToCart(product);
                    if (!firstHalf) return setFirstHalf(product);
                    const finalPrice = calculateHalfHalfPrice(firstHalf.price, product.price);
                    addToCart({ ...firstHalf, id: `combo-${Date.now()}`, name: `Pizza: ${firstHalf.name} / ${product.name}`, price: finalPrice, category: 'Pizzas', is_combo: true });
                    setFirstHalf(null);
                  }} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 hover:shadow-md cursor-pointer transition-all active:scale-95 relative group">
                    <button onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id, !!product.is_favorite); }} className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-gray-100"><Star size={16} className={product.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} /></button>
                    <h3 className="font-bold text-gray-800 text-sm mb-1 pr-6">{product.name}</h3>
                    <div className="text-orange-600 font-bold mt-2">$ {product.price.toLocaleString()}</div>
                  </div>
                ))}
                {selectedCategory === 'Promociones' && promotions.map(promo => (
                  <div key={promo.id} className="bg-purple-50 rounded-xl p-3 border border-purple-100 cursor-pointer hover:shadow-md transition-all">
                    <h3 className="font-bold text-purple-900 text-sm flex items-center gap-2"><Tag size={16} /> {promo.name}</h3>
                    <span className="text-[10px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded font-bold">{promo.discount_percentage}% OFF</span>
                  </div>
                ))}
              </div>
            </div>

            <aside className={`w-full md:w-96 bg-white border-l border-gray-200 flex flex-col h-full absolute md:static inset-0 ${mobileView === 'products' ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-4 border-b bg-gray-50 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1" ref={searchContainerRef}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input type="text" placeholder="Cliente..." className="w-full pl-9 p-2.5 border rounded-lg text-sm bg-white" value={clientSearchTerm} onChange={e => { setClientSearchTerm(e.target.value); setShowClientDropdown(true); }} onFocus={() => setShowClientDropdown(true)} />
                    {showClientDropdown && filteredCustomers.length > 0 && (
                      <div className="absolute w-full mt-1 bg-white border rounded-lg shadow-xl z-50 max-h-40 overflow-auto">
                        {filteredCustomers.map(c => <div key={c.id} onClick={() => { setSelectedCustomerId(c.id); setClientSearchTerm(c.name); setShowClientDropdown(false); }} className="p-3 hover:bg-orange-50 cursor-pointer text-sm border-b">{c.name}</div>)}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setShowQuickCustomer(true)} className="p-2.5 bg-white border rounded-lg text-gray-500 hover:text-orange-600"><UserPlus size={20} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {cart.length === 0 && <div className="text-center py-20 text-gray-300"><ShoppingCart className="mx-auto opacity-20 mb-2" size={40} /><p>Nada por aquí</p></div>}
                {groupedCart.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-lg border shadow-sm">
                    <div className="flex-1"><p className="font-medium text-sm">{item.name}</p><p className="text-xs text-orange-600 font-bold">$ {item.subtotalPrice.toLocaleString()}</p></div>
                    <div className="flex items-center gap-2"><button onClick={() => { const idx = cart.findIndex(i => i.id === item.id); if (idx !== -1) { const n = [...cart]; n.splice(idx, 1); setCart(n); } }} className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded">-</button><span className="text-sm font-bold w-4 text-center">{item.quantity}</span><button onClick={() => addToCart(item)} className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-600 rounded">+</button></div>
                  </div>
                ))}
              </div>
              <div className="p-6 border-t bg-gray-50">
                <div className="flex justify-between mb-4 text-xl font-bold"><span>Total</span><span className="text-orange-600">$ {finalTotal.toLocaleString()}</span></div>
                <button onClick={handleCheckout} disabled={!selectedCustomerId || cart.length === 0 || isProcessing} className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 transition-all hover:bg-orange-600">{isProcessing ? 'Procesando...' : 'Confirmar Pedido'}</button>
                {mobileView === 'cart' && <button onClick={() => setMobileView('products')} className="w-full mt-3 py-2 text-gray-500 font-medium">Volver a productos</button>}
              </div>
            </aside>
          </div>
        )}

        <div className="flex-1 overflow-auto relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === 'pos' && (
                <div className="h-full flex flex-col md:flex-row overflow-hidden pt-16 md:pt-0">
                  {/* POS UI... actual content already exists between 252-323 approximately */}
                </div>
              )}
              {activeTab === 'kitchen' && <Kitchen demoOrders={demoOrders} onDemoComplete={id => setDemoOrders(prev => prev.filter(o => o.id !== id))} companyName={companyName} />}
              {activeTab === 'customers' && <Customers />}
              {activeTab === 'reservations' && <Reservations />}
              {activeTab === 'inventory' && <Inventory />}
              {activeTab === 'history' && <History />}
              {activeTab === 'reports' && <Reports />}
              {(activeTab === 'users' || activeTab === 'clients') && <Users />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* MODALES */}
      {showQuickCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-sm">
            <h3 className="text-xl font-bold mb-4">Nuevo Cliente</h3>
            {formError && <div className="bg-red-50 text-red-600 p-2 rounded text-xs mb-3">{formError}</div>}
            <div className="space-y-3 mb-6">
              <input className="w-full p-3 border rounded-lg" placeholder="Nombre" value={newClientData.name} onChange={e => setNewClientData({ ...newClientData, name: e.target.value })} />
              <input className="w-full p-3 border rounded-lg" placeholder="Dirección" value={newClientData.address} onChange={e => setNewClientData({ ...newClientData, address: e.target.value })} />
              <input className="w-full p-3 border rounded-lg" placeholder="Teléfono" value={newClientData.phone} onChange={e => setNewClientData({ ...newClientData, phone: e.target.value })} />
            </div>
            <div className="flex gap-2"><button onClick={() => setShowQuickCustomer(false)} className="flex-1 py-3 bg-gray-100 rounded-lg">Cancelar</button><button onClick={handleQuickCustomerCreate} className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-lg uppercase text-sm">Guardar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick, shortcut }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all font-medium text-sm ${active ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-100 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>
      <div className="flex items-center gap-3">
        <span className={active ? 'text-orange-600' : 'text-gray-400'}>{icon}</span>
        <span>{label}</span>
      </div>
      {shortcut && <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-400 border border-gray-200 group-hover:bg-white">{shortcut}</span>}
    </button>
  );
}

export default App;