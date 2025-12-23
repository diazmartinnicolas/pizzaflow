import { useEffect, useState } from 'react';
import { supabase } from './services/supabase';
import Login from './components/Login';
import Kitchen from './components/Kitchen';
import Inventory from './components/Inventory';
import Customers from './components/Customers';
import Promotions from './components/Promotions';
import Users from './components/Users';
import History from './components/History';
import Reservations from './components/Reservations';
import { 
  ShoppingCart, ChefHat, Users as UsersIcon, Package, Percent, 
  History as HistoryIcon, UserCog, LogOut, MinusCircle, Tag, 
  UserPlus, Key, X, Search, CalendarClock, Menu, Receipt 
} from 'lucide-react';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('pos');
  const [selectedCategory, setSelectedCategory] = useState('Todo');
  
  // VISTA MÓVIL: 'products' o 'cart'
  const [mobileView, setMobileView] = useState('products');

  // DATOS
  const [products, setProducts] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  
  // ESTADOS VARIOS
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showMobileMenu, setShowMobileMenu] = useState(false); // Menú hamburguesa móvil

  const categories = ['Todo', 'Pizzas', 'Milanesas', 'Hamburguesas', 'Empanadas', 'Bebidas', 'Postres'];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserRole(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchUserRole(session.user.id);
      else { setUserRole(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
    if (data) {
      setUserRole(data.role);
      if (data.role === 'cocina') setActiveTab('kitchen');
    }
    fetchData(); 
    setLoading(false);
  };

  const fetchData = async () => {
    const { data: prodData } = await supabase.from('products').select('*').eq('active', true);
    if (prodData) setProducts(prodData);
    const { data: promoData } = await supabase.from('promotions').select('*').eq('active', true);
    if (promoData) setPromotions(promoData);
    const { data: clientData } = await supabase.from('clients').select('*').order('name');
    if (clientData) setCustomers(clientData);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload(); 
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) return alert("Mínimo 6 caracteres.");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) alert("Error: " + error.message);
    else { alert("¡Contraseña actualizada!"); setShowPasswordModal(false); setNewPassword(''); }
  };

  const addToCart = (product: any) => {
    setCart([...cart, { ...product, cartId: Date.now() + Math.random() }]);
    // Opcional: Vibración al agregar en celular
    if (navigator.vibrate) navigator.vibrate(50);
  };
  
  const removeFromCart = (cartId: number) => setCart(cart.filter(item => item.cartId !== cartId));

  const calculateTotals = () => {
    let tempCart = [...cart];
    let appliedDiscounts: any[] = [];
    let subtotal = cart.reduce((sum, item) => sum + item.price, 0);

    promotions.forEach(promo => {
      while (true) {
        const index1 = tempCart.findIndex(item => item.id === promo.product_1_id);
        const index2 = promo.product_2_id ? tempCart.findIndex((item, idx) => item.id === promo.product_2_id && idx !== index1) : -1;
        
        if (promo.product_2_id) {
          if (index1 !== -1 && index2 !== -1) {
            const amount = (tempCart[index1].price + tempCart[index2].price) * (promo.discount_percentage / 100);
            appliedDiscounts.push({ name: promo.name, amount });
            const ids = [tempCart[index1].cartId, tempCart[index2].cartId];
            tempCart = tempCart.filter(item => !ids.includes(item.cartId));
          } else break;
        } else {
          if (index1 !== -1) {
            appliedDiscounts.push({ name: promo.name, amount: tempCart[index1].price * (promo.discount_percentage / 100) });
            const idToRemove = tempCart[index1].cartId;
            tempCart = tempCart.filter(item => item.cartId !== idToRemove);
          } else break;
        }
      }
    });
    const totalDiscount = appliedDiscounts.reduce((sum, d) => sum + d.amount, 0);
    return { subtotal, totalDiscount, finalTotal: subtotal - totalDiscount, appliedDiscounts };
  };

  const { finalTotal, subtotal, totalDiscount, appliedDiscounts } = calculateTotals();

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!selectedCustomerId) return alert("Selecciona un cliente.");
    setIsProcessing(true);
    try {
      const { data: orderData, error: orderError } = await supabase.from('orders').insert([{ client_id: selectedCustomerId, total: finalTotal, status: 'pendiente', payment_type: 'efectivo', created_by: session.user.id }]).select().single();
      if (orderError) throw orderError;
      const itemCounts: any = {};
      cart.forEach(item => { itemCounts[item.id] = (itemCounts[item.id] || 0) + 1; });
      const orderItems = Object.keys(itemCounts).map(productId => {
        const product = products.find(p => p.id === productId);
        return { order_id: orderData.id, product_id: productId, quantity: itemCounts[productId], price_at_moment: product.price };
      });
      await supabase.from('order_items').insert(orderItems);
      alert(`¡Ticket #${orderData.ticket_number} enviado!`);
      setCart([]);
      setSelectedCustomerId('');
      setClientSearchTerm('');
      setMobileView('products'); // Volver a productos en móvil
    } catch (error: any) { alert("Error: " + error.message); } 
    finally { setIsProcessing(false); }
  };

  const handleQuickCustomerCreate = async () => {
    if(!quickCustomerName) return;
    const { data, error } = await supabase.from('clients').insert([{ name: quickCustomerName }]).select().single();
    if (error) alert("Error: " + error.message);
    else {
      setCustomers([data, ...customers]); 
      setSelectedCustomerId(data.id);
      setClientSearchTerm(data.name); 
      setShowQuickCustomer(false);
      setQuickCustomerName('');
    }
  };

  const filteredProducts = selectedCategory === 'Todo' ? products : products.filter(p => p.category === selectedCategory);
  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()));

  if (loading) return <div className="h-dvh flex items-center justify-center">Cargando PizzaFlow...</div>;
  if (!session) return <Login />;

  // --- VISTA COCINA (Simplificada) ---
  if (userRole === 'cocina') {
    return (
      <div className="h-dvh flex flex-col bg-gray-900">
        <div className="bg-gray-800 text-white p-4 flex justify-between items-center safe-area-top">
          <h1 className="font-bold text-xl flex items-center gap-2">👨‍🍳 Cocina</h1>
          <button onClick={handleLogout} className="text-red-300"><LogOut size={20}/></button>
        </div>
        <div className="flex-1 overflow-hidden"><Kitchen /></div>
      </div>
    );
  }

  // --- LAYOUT PRINCIPAL RESPONSIVE ---
  return (
    <div className="flex h-dvh bg-gray-50 font-sans text-gray-800 overflow-hidden">
      
      {/* SIDEBAR (Solo Desktop) */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between hidden md:flex">
        {/* ... (Mismo contenido de sidebar desktop que antes) ... */}
        <div>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-orange-100 p-2 rounded-full"><span className="text-2xl">🍕</span></div>
              <h1 className="text-xl font-bold text-orange-600 tracking-tight">PizzaFlow</h1>
            </div>
            <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
              <span className="text-xs text-gray-500 uppercase font-bold ml-1">{userRole}</span>
              <button onClick={() => setShowPasswordModal(true)} className="p-1 text-gray-400 hover:text-orange-600"><Key size={14} /></button>
            </div>
          </div>
          <nav className="px-4 space-y-1">
            <SidebarItem icon={<ShoppingCart size={20}/>} label="Punto de Venta" active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} />
            <SidebarItem icon={<ChefHat size={20}/>} label="Cocina" active={activeTab === 'kitchen'} onClick={() => setActiveTab('kitchen')} />
            <SidebarItem icon={<UsersIcon size={20}/>} label="Clientes" active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} />
            {userRole === 'admin' && (
              <>
                <div className="pt-4 pb-2 px-4 text-xs font-semibold text-gray-400 uppercase">Administración</div>
                <SidebarItem icon={<CalendarClock size={20}/>} label="Reservas" active={activeTab === 'reservations'} onClick={() => setActiveTab('reservations')} />
                <SidebarItem icon={<Package size={20}/>} label="Inventario" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
                <SidebarItem icon={<Percent size={20}/>} label="Promociones" active={activeTab === 'promos'} onClick={() => setActiveTab('promos')} />
                <SidebarItem icon={<HistoryIcon size={20}/>} label="Historial" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
                <SidebarItem icon={<UserCog size={20}/>} label="Usuarios" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
              </>
            )}
          </nav>
        </div>
        <div className="p-4 border-t">
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><LogOut size={20} /> Salir</button>
        </div>
      </aside>

      {/* HEADER MÓVIL (Solo Celulares) */}
      <header className="md:hidden fixed top-0 w-full bg-white z-20 border-b flex justify-between items-center p-4 safe-area-top shadow-sm h-16">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍕</span>
          <h1 className="font-bold text-orange-600">PizzaFlow</h1>
        </div>
        <div className="flex gap-3">
            {activeTab === 'pos' && (
                <div className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <ShoppingCart size={14}/> {cart.length}
                </div>
            )}
            <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="text-gray-600"><Menu/></button>
        </div>
      </header>
      
      {/* MENÚ HAMBURGUESA MÓVIL (Overlay) */}
      {showMobileMenu && (
        <div className="fixed inset-0 bg-black/50 z-50 md:hidden backdrop-blur-sm" onClick={() => setShowMobileMenu(false)}>
          <div className="bg-white w-64 h-full p-4 flex flex-col shadow-2xl animate-in slide-in-from-left" onClick={e => e.stopPropagation()}>
             <div className="flex justify-between items-center mb-6 border-b pb-4">
               <span className="font-bold text-lg text-gray-700">Menú</span>
               <button onClick={() => setShowMobileMenu(false)}><X/></button>
             </div>
             <nav className="space-y-2 flex-1 overflow-y-auto">
                {/* Reutilizamos los items, al hacer click cierran el menú */}
                <SidebarItem icon={<ShoppingCart size={20}/>} label="Punto de Venta" active={activeTab === 'pos'} onClick={() => { setActiveTab('pos'); setShowMobileMenu(false); }} />
                <SidebarItem icon={<ChefHat size={20}/>} label="Cocina" active={activeTab === 'kitchen'} onClick={() => { setActiveTab('kitchen'); setShowMobileMenu(false); }} />
                <SidebarItem icon={<UsersIcon size={20}/>} label="Clientes" active={activeTab === 'customers'} onClick={() => { setActiveTab('customers'); setShowMobileMenu(false); }} />
                {userRole === 'admin' && (
                   <>
                     <div className="pt-2 pb-1 text-xs font-bold text-gray-400 uppercase">Admin</div>
                     <SidebarItem icon={<CalendarClock size={20}/>} label="Reservas" active={activeTab === 'reservations'} onClick={() => { setActiveTab('reservations'); setShowMobileMenu(false); }} />
                     <SidebarItem icon={<Package size={20}/>} label="Inventario" active={activeTab === 'inventory'} onClick={() => { setActiveTab('inventory'); setShowMobileMenu(false); }} />
                     <SidebarItem icon={<HistoryIcon size={20}/>} label="Historial" active={activeTab === 'history'} onClick={() => { setActiveTab('history'); setShowMobileMenu(false); }} />
                     <SidebarItem icon={<UserCog size={20}/>} label="Usuarios" active={activeTab === 'users'} onClick={() => { setActiveTab('users'); setShowMobileMenu(false); }} />
                   </>
                )}
             </nav>
             <button onClick={handleLogout} className="mt-4 flex items-center gap-2 text-red-500 w-full p-2 hover:bg-red-50 rounded"><LogOut size={20}/> Salir</button>
          </div>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 relative pt-16 md:pt-0">
        
        {activeTab === 'pos' && (
          <div className="flex h-full flex-col md:flex-row"> {/* Cambia dirección flex en móvil */}
            
            {/* SECCIÓN PRODUCTOS: Visible siempre en desktop, o si mobileView es 'products' */}
            <div className={`flex-1 overflow-y-auto p-4 md:p-6 ${mobileView === 'cart' ? 'hidden md:block' : 'block'}`}>
              <header className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar"> {/* no-scrollbar es opcional */}
                {categories.map((cat) => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 ${selectedCategory === cat ? 'bg-orange-500 text-white shadow-md' : 'bg-white border text-gray-600'}`}>{cat}</button>
                ))}
              </header>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-24 md:pb-0"> {/* Padding bottom extra para el botón flotante móvil */}
                {filteredProducts.map((product) => (
                  <div key={product.id} onClick={() => addToCart(product)} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex justify-between items-center md:block md:p-4 hover:shadow-md cursor-pointer active:scale-95 duration-100">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 text-sm md:text-lg mb-1">{product.name}</h3>
                      <span className="text-[10px] md:text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">{product.category}</span>
                    </div>
                    <div className="font-bold text-base md:text-xl text-orange-600 md:mt-2 whitespace-nowrap ml-2">$ {product.price.toLocaleString('es-AR')}</div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* BOTÓN FLOTANTE "VER CARRITO" (SOLO MÓVIL) */}
            <div className={`md:hidden fixed bottom-6 left-4 right-4 z-30 transition-transform ${mobileView === 'products' && cart.length > 0 ? 'translate-y-0' : 'translate-y-24'}`}>
                <button 
                    onClick={() => setMobileView('cart')}
                    className="w-full bg-orange-600 text-white p-4 rounded-xl shadow-xl flex justify-between items-center font-bold text-lg"
                >
                    <span className="bg-white/20 px-3 py-1 rounded-lg text-sm">{cart.length} ítems</span>
                    <span>Ver Pedido</span>
                    <span>$ {finalTotal.toLocaleString()}</span>
                </button>
            </div>

            {/* SECCIÓN CARRITO: Visible siempre en desktop, o si mobileView es 'cart' */}
            <aside className={`w-full md:w-96 bg-white md:border-l border-gray-200 flex flex-col h-full shadow-xl z-10 absolute md:static inset-0 ${mobileView === 'products' ? 'hidden md:flex' : 'flex'}`}>
              
              {/* Header Carrito Móvil (Botón volver) */}
              <div className="md:hidden p-4 border-b flex items-center gap-3">
                  <button onClick={() => setMobileView('products')} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button>
                  <span className="font-bold text-lg">Tu Pedido</span>
              </div>

              {/* BUSCADOR CLIENTES */}
              <div className="p-4 border-b border-gray-100 bg-gray-50 relative">
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Cliente</label>
                <div className="flex gap-2">
                  <div className="relative w-full">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={16} /></div>
                    <input type="text" placeholder="Buscar..." className="w-full pl-9 p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 bg-white text-sm"
                      value={clientSearchTerm}
                      onChange={(e) => { setClientSearchTerm(e.target.value); setShowClientDropdown(true); if(e.target.value === '') setSelectedCustomerId(''); }}
                      onFocus={() => setShowClientDropdown(true)}
                    />
                    {showClientDropdown && filteredCustomers.length > 0 && (
                      <div className="absolute w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-40 overflow-y-auto z-50">
                        {filteredCustomers.map(c => (
                          <div key={c.id} onClick={() => { setSelectedCustomerId(c.id); setClientSearchTerm(c.name); setShowClientDropdown(false); }}
                            className="p-3 hover:bg-orange-50 cursor-pointer border-b border-gray-50 flex justify-between items-center text-sm">
                            <span className="font-medium text-gray-800">{c.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setShowQuickCustomer(true)} className="bg-orange-100 p-3 rounded-lg text-orange-600 flex-shrink-0"><UserPlus size={20}/></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-24 md:pb-4">
                {cart.length === 0 && <div className="text-center text-gray-400 mt-10">Carrito vacío</div>}
                {cart.map((item) => (
                  <div key={item.cartId} className="flex justify-between items-center bg-white border border-gray-100 p-3 rounded-lg shadow-sm">
                    <div><p className="font-medium text-sm">{item.name}</p><p className="text-gray-500 text-xs">$ {item.price}</p></div>
                    <button onClick={() => removeFromCart(item.cartId)} className="text-red-400 hover:text-red-600 p-2"><MinusCircle size={18}/></button>
                  </div>
                ))}
                {appliedDiscounts.length > 0 && <div className="mt-4 pt-4 border-t border-dashed"><p className="text-xs font-bold uppercase text-gray-500">Descuentos</p>{appliedDiscounts.map((d, i) => <div key={i} className="flex justify-between text-green-600 text-sm"><span>{d.name}</span><span>- ${d.amount}</span></div>)}</div>}
              </div>
              
              <div className="p-6 bg-gray-50 border-t md:relative fixed bottom-0 left-0 right-0 md:bottom-auto md:left-auto md:right-auto z-20 pb-8 md:pb-6 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                <div className="flex justify-between mb-4 text-2xl font-bold"><span>Total</span><span className="text-orange-600">$ {finalTotal.toLocaleString('es-AR')}</span></div>
                <button onClick={handleCheckout} disabled={cart.length === 0} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                    <Receipt size={20}/> Confirmar Pedido
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* COMPONENTES DE OTRAS PESTAÑAS (Adaptados con scroll) */}
        <div className="flex-1 overflow-auto">
            {activeTab === 'kitchen' && <Kitchen />}
            {activeTab === 'customers' && <Customers />}
            {userRole === 'admin' && activeTab === 'reservations' && <Reservations />}
            {userRole === 'admin' && activeTab === 'inventory' && <Inventory />}
            {userRole === 'admin' && activeTab === 'promos' && <Promotions />}
            {userRole === 'admin' && activeTab === 'history' && <History />}
            {userRole === 'admin' && activeTab === 'users' && <Users />}
        </div>

        {/* MODAL CREAR CLIENTE RÁPIDO */}
        {showQuickCustomer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm">
              <h3 className="text-xl font-bold mb-4">Nuevo Cliente</h3>
              <input autoFocus className="w-full p-3 border rounded-lg mb-4 text-lg" placeholder="Nombre" value={quickCustomerName} onChange={e => setQuickCustomerName(e.target.value)} />
              <div className="flex gap-2"><button onClick={() => setShowQuickCustomer(false)} className="flex-1 py-3 text-gray-500">Cancelar</button><button onClick={handleQuickCustomerCreate} className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-lg">Guardar</button></div>
            </div>
          </div>
        )}

        {/* MODAL CAMBIO CONTRASEÑA */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm">
              <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold flex items-center gap-2">🔑 Nueva Clave</h3><button onClick={() => setShowPasswordModal(false)}><X/></button></div>
              <input type="password" placeholder="Mínimo 6 caracteres" className="w-full p-3 border rounded-lg mb-4" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <button onClick={handleChangePassword} className="w-full py-3 bg-orange-600 text-white font-bold rounded-lg">Actualizar</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-medium mb-1 ${active ? 'bg-orange-50 text-orange-600 shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
      {icon} <span>{label}</span>
    </button>
  );
}

export default App;