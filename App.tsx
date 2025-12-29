import { useEffect, useState } from 'react';
import { supabase } from './services/supabase'; 
import { logAction } from './services/audit'; 
import { Login } from './components/Login';
import Kitchen from './components/Kitchen';
import Inventory from './components/Inventory';
import Customers from './components/Customers';
import Promotions from './components/Promotions';
import Users from './components/Users';
import History from './components/History';
import Reservations from './components/Reservations';

// Iconos
import { 
  ShoppingCart, ChefHat, Users as UsersIcon, Package, Percent, 
  History as HistoryIcon, UserCog, LogOut, MinusCircle, 
  UserPlus, Key, X, Search, CalendarClock, Menu, Receipt,
  LayoutDashboard, Monitor, Crown, BarChart3, Briefcase, Tag,
  Building2 
} from 'lucide-react';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Navegación
  const [activeTab, setActiveTab] = useState('pos');
  const [selectedCategory, setSelectedCategory] = useState('Todo');
  
  // VISTA MÓVIL
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
  const [showMobileMenu, setShowMobileMenu] = useState(false); 

  // Lógica de Permisos
  const currentUserEmail = session?.user?.email?.toLowerCase().trim() || '';
  const isDemo = currentUserEmail.includes('demo');
  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin' || userRole === 'super_admin' || isDemo;

  const categories = ['Todo', 'Promociones', 'Pizzas', 'Milanesas', 'Hamburguesas', 'Empanadas', 'Bebidas', 'Postres'];

  // --- CÁLCULO DE TOTALES (Movido aquí arriba para estar disponible siempre) ---
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

  // Desestructuramos los valores calculados para usarlos en el render
  const { finalTotal, appliedDiscounts } = calculateTotals();


  // --- GESTIÓN DE SESIÓN ROBUSTA ---
  useEffect(() => {
    // 1. Chequeo Inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
          // Si hay sesión, MANTENEMOS loading=true y verificamos rol
          fetchUserRole(session); 
      } else {
          // Si no hay sesión, quitamos loading para mostrar Login
          setLoading(false);
      }
    });

    // 2. Suscripción a cambios
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      
      if (event === 'SIGNED_IN' && session) {
          setLoading(true); // ACTIVAR ESCUDO DE CARGA
          logAction('LOGIN', 'Inicio de sesión exitoso', 'Sistema');
          fetchUserRole(session);
      } else if (event === 'SIGNED_OUT' || !session) {
          setUserRole(null); 
          setLoading(false); // Mostrar Login
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- FUNCIÓN DE SEGURIDAD "PORTERO" (Bloqueante) ---
  const fetchUserRole = async (currentSession: any) => {
    const userId = currentSession.user.id;
    const email = currentSession.user.email;

    // 1. Bypass para Demo
    if (email?.toLowerCase().includes('demo')) {
        setUserRole('admin');
        await fetchData(); 
        setLoading(false); // Liberar UI
        return;
    }

    try {
        // 2. CONSULTA BLINDADA
        const { data, error } = await supabase
            .from('profiles')
            .select(`
                role, 
                company_id,
                companies (
                    name,
                    status
                )
            `)
            .eq('id', userId)
            .maybeSingle(); 
        
        // --- CASO 1: USUARIO ELIMINADO (Huérfano) ---
        if (!data) {
            console.error("⛔ SEGURIDAD: Usuario sin perfil detectado.");
            alert("⛔ ACCESO DENEGADO\n\nTu usuario ha sido eliminado del sistema o no tiene permisos asignados.");
            
            await supabase.auth.signOut();
            setSession(null); // Limpiar sesión en memoria
            setLoading(false); // Mostrar Login
            return;
        }

        // --- CASO 2: EMPRESA INACTIVA (Suscripción Vencida) ---
        const company: any = data.companies; 
        const isSuperUser = data.role === 'super_admin';

        if (company && company.status === 'inactive' && !isSuperUser) {
            console.warn(`⛔ SEGURIDAD: Empresa ${company.name} inactiva.`);
            alert("⚠️ CUENTA SUSPENDIDA\n\nLa suscripción de tu empresa se encuentra inactiva. Contacta al administrador.");
            
            await supabase.auth.signOut();
            setSession(null); // Limpiar sesión en memoria
            setLoading(false); // Mostrar Login
            return;
        }

        // 3. ÉXITO: ASIGNAR ROL
        console.log("✅ Acceso concedido. Rol:", data.role);
        setUserRole(data.role);
        
        if (data.role === 'cocina') setActiveTab('kitchen');

        // Cargar datos de negocio
        await fetchData();

    } catch (error) {
        console.error("Error crítico validando usuario:", error);
        alert("Error de conexión validando credenciales. Intente nuevamente.");
        await supabase.auth.signOut();
        setSession(null);
    }
    
    // FINALMENTE, LIBERAR LA PANTALLA DE CARGA
    setLoading(false);
  };

  const fetchData = async () => {
    try {
        const { data: prodData } = await supabase.from('products').select('*'); 
        if (prodData) setProducts(prodData);

        const { data: promoData } = await supabase.from('promotions').select('*');
        if (promoData) setPromotions(promoData);

        const { data: clientData } = await supabase.from('clients').select('*').order('name');
        
        let demoIds: string[] = [];
        try {
            if (isAdmin) {
                const { data: profiles } = await supabase.from('profiles').select('id, email');
                if (profiles) {
                    demoIds = profiles
                        .filter((p: any) => p.email?.toLowerCase().includes('demo'))
                        .map((p: any) => p.id);
                }
            }
        } catch (e) { console.warn(e); }

        if (clientData) {
             const myId = session?.user?.id;
             let cleanList = clientData;

             if (currentUserEmail.includes('demo')) {
                cleanList = clientData.filter((c: any) => c.user_id === myId);
             } else if (demoIds.length > 0) {
                cleanList = clientData.filter((c: any) => !demoIds.includes(c.user_id));
             }
             setCustomers(cleanList);
        }
    } catch (error) { console.error(error); }
  };

  const handleLogout = async () => {
    await logAction('LOGOUT', 'Usuario cerró sesión', 'Sistema');
    await supabase.auth.signOut();
    // No recargamos la página, dejamos que el useEffect maneje el estado
    setSession(null);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) return alert("Mínimo 6 caracteres.");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) alert("Error: " + error.message);
    else { 
        await logAction('CAMBIO_CLAVE', 'Usuario actualizó su contraseña', 'Sistema');
        alert("¡Contraseña actualizada!"); 
        setShowPasswordModal(false); 
        setNewPassword(''); 
    }
  };

  const addToCart = (product: any) => {
    setCart(currentCart => [...currentCart, { ...product, cartId: Date.now() + Math.random() }]);
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleAddPromotionToCart = (promo: any) => {
      const product1 = products.find(p => p.id === promo.product_1_id);
      if (product1) addToCart(product1);
      if (promo.product_2_id) {
          const product2 = products.find(p => p.id === promo.product_2_id);
          if (product2) setTimeout(() => addToCart(product2), 50); 
      } else {
          if (promo.name.toLowerCase().includes('2x1')) setTimeout(() => addToCart(product1), 50);
      }
  };
  
  const removeFromCart = (cartId: number) => setCart(cart.filter(item => item.cartId !== cartId));


  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!selectedCustomerId) return alert("Selecciona un cliente.");
    setIsProcessing(true);

    if (isDemo) {
        setTimeout(() => {
            alert("Pedido Simulado.");
            setCart([]);
            setIsProcessing(false);
        }, 800);
        return; 
    }

    if (!session || !session.user || !session.user.id) {
        alert("Error crítico: No se detectó la sesión del usuario.");
        setIsProcessing(false);
        return;
    }

    try {
      const { data: orderData, error: orderError } = await supabase.from('orders').insert([{ client_id: selectedCustomerId, total: finalTotal, status: 'pendiente', payment_type: 'efectivo', user_id: session.user.id }]).select().single();
      if (orderError) throw orderError;

      const itemCounts: any = {};
      cart.forEach(item => { itemCounts[item.id] = (itemCounts[item.id] || 0) + 1; });
      const orderItems = Object.keys(itemCounts).map(productId => {
        const product = products.find(p => p.id === productId);
        return { order_id: orderData.id, product_id: productId, quantity: itemCounts[productId], price_at_moment: product.price };
      });
      
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;
      
      await logAction('VENTA', `Ticket #${orderData.ticket_number} - $${finalTotal}`, 'Caja');
      alert(`¡Ticket #${orderData.ticket_number || 'OK'} enviado!`);
      setCart([]);
      setSelectedCustomerId('');
      setClientSearchTerm('');
      setMobileView('products');

    } catch (error: any) { 
        console.error("Error al confirmar:", error);
        alert("Error: " + error.message); 
    } 
    finally { setIsProcessing(false); }
  };

  const handleQuickCustomerCreate = async () => {
    if(!quickCustomerName) return;
    if (isDemo) { alert("Cliente Simulado."); setShowQuickCustomer(false); return; }

    try {
        const { data, error } = await supabase.from('clients').insert([{ name: quickCustomerName, user_id: session.user.id }]).select().single();
        if (error) throw error;
        await logAction('CREAR_CLIENTE', `Rápido: ${data.name}`, 'Clientes');
        setCustomers([data, ...customers]); 
        setSelectedCustomerId(data.id);
        setClientSearchTerm(data.name); 
        setShowQuickCustomer(false);
        setQuickCustomerName('');
    } catch (error: any) { alert("Error: " + error.message); }
  };

  const getRoleLabel = () => {
    if (isDemo) return 'Usuario Demo';
    const role = userRole?.toLowerCase();
    if (role === 'super_admin') return 'CEO / Super Admin';
    if (role === 'admin') return 'Administrador';
    if (role === 'cashier' || role === 'cajero') return 'Cajero';
    if (role === 'cocina') return 'Cocina';
    return 'Usuario';
  };

  const filteredProducts = selectedCategory === 'Todo' ? products : products.filter(p => p.category === selectedCategory);
  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()));

  // -----------------------------------------------------------
  // RENDERIZADO CONDICIONAL (ESCUDO DE CARGA)
  // -----------------------------------------------------------
  
  // Si está cargando, mostramos splash screen y NADA MÁS.
  if (loading) {
      return (
        <div className="h-dvh flex flex-col items-center justify-center bg-gray-50">
            <div className="animate-spin mb-4">
                <PizzaIcon className="w-12 h-12 text-orange-500 opacity-50" />
            </div>
            <div className="text-orange-600 font-bold animate-pulse text-lg">Cargando PizzaFlow...</div>
        </div>
      );
  }

  // Si no carga y no hay sesión, mostramos Login
  if (!session) return <Login />;

  // Si hay sesión y el rol es Cocina, mostramos KDS
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

  // Si pasó todo, mostramos la App Principal
  return (
    <div className="flex h-dvh bg-gray-50 font-sans text-gray-800 overflow-hidden">
      
      {/* SIDEBAR DESKTOP */}
      <aside className="w-64 bg-white border-r border-gray-200 flex-col justify-between hidden md:flex z-50">
        <div>
          <div className="p-5 pb-2">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-orange-100 p-2 rounded-full"><PizzaIcon className="w-6 h-6 text-orange-600" /></div>
              <h1 className="text-xl font-bold text-gray-800 tracking-tight">PizzaFlow</h1>
            </div>

            <div className={`flex items-center justify-between px-3 py-3 rounded-xl border mb-2 shadow-sm transition-all ${isDemo ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200' : 'bg-white border-gray-200'}`}>
              <div className="flex flex-col">
                <span className={`text-[10px] font-extrabold tracking-wider uppercase mb-0.5 ${isDemo ? 'text-orange-600' : 'text-gray-400'}`}>
                  {isDemo ? 'MODO VISITA' : 'TU ROL'}
                </span>
                <div className="flex items-center gap-1.5">
                  {isDemo ? <Monitor className="w-3.5 h-3.5 text-orange-700" /> : 
                   isSuperAdmin ? <ShieldCheckIcon className="w-3.5 h-3.5 text-purple-600" /> :
                   userRole === 'admin' ? <Crown className="w-3.5 h-3.5 text-yellow-500" /> :
                   <Briefcase className="w-3.5 h-3.5 text-blue-500" />}
                  
                  <span className={`text-sm font-bold truncate ${isDemo ? 'text-orange-800' : 'text-gray-800'}`}>
                    {getRoleLabel()}
                  </span>
                </div>
              </div>
              {!isDemo && (
                <button onClick={() => setShowPasswordModal(true)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-gray-50 rounded-lg transition-colors"><Key className="w-4 h-4" /></button>
              )}
            </div>
          </div>
          
          <nav className="px-3 space-y-1">
            <SidebarItem icon={<ShoppingCart size={20}/>} label="Punto de Venta" active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} />
            <SidebarItem icon={<ChefHat size={20}/>} label="Cocina" active={activeTab === 'kitchen'} onClick={() => setActiveTab('kitchen')} />
            <SidebarItem icon={<UsersIcon size={20}/>} label="Clientes" active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} />
            
            {isAdmin && (
              <>
                <div className="px-4 mt-6 mb-2 flex items-center gap-2">
                  <div className="h-px flex-1 bg-gray-100"></div>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Gestión</span>
                  <div className="h-px flex-1 bg-gray-100"></div>
                </div>

                {isSuperAdmin ? (
                   <SidebarItem 
                      icon={<Building2 size={20}/>} 
                      label="Clientes/Usuarios" 
                      active={activeTab === 'clients'} 
                      onClick={() => setActiveTab('clients')} 
                    />
                ) : (
                   <SidebarItem 
                      icon={<UserCog size={20}/>} 
                      label="Personal" 
                      active={activeTab === 'users'} 
                      onClick={() => setActiveTab('users')} 
                    />
                )}

                <SidebarItem icon={<CalendarClock size={20}/>} label="Reservas" active={activeTab === 'reservations'} onClick={() => setActiveTab('reservations')} />
                <SidebarItem icon={<Package size={20}/>} label="Inventario" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
                <SidebarItem icon={<Percent size={20}/>} label="Promociones" active={activeTab === 'promos'} onClick={() => setActiveTab('promos')} />
                <SidebarItem icon={<HistoryIcon size={20}/>} label="Historial" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
                <SidebarItem icon={<BarChart3 size={20}/>} label="Reportes" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
              </>
            )}
          </nav>
        </div>
        <div className="p-4 border-t">
          <button onClick={handleLogout} className="flex items-center justify-center gap-3 w-full px-4 py-2.5 text-gray-600 bg-white border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 rounded-xl transition-all font-medium text-sm shadow-sm">
            <LogOut size={18} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* MENÚ MÓVIL */}
      {showMobileMenu && (
        <div className="fixed inset-0 bg-black/50 z-50 md:hidden backdrop-blur-sm" onClick={() => setShowMobileMenu(false)}>
          <div className="bg-white w-72 h-full p-4 flex flex-col shadow-2xl animate-in slide-in-from-left" onClick={e => e.stopPropagation()}>
             <div className="bg-gray-100 p-4 rounded-xl mb-4">
                <p className="text-xs font-bold uppercase text-gray-500">{isDemo ? 'Modo Demo' : 'Usuario'}</p>
                <p className="text-sm font-medium truncate">{session?.user?.email}</p>
             </div>

             <nav className="space-y-1 flex-1 overflow-y-auto">
                <SidebarItem icon={<LayoutDashboard size={20}/>} label="Panel Principal" active={activeTab === 'pos'} onClick={() => { setActiveTab('pos'); setShowMobileMenu(false); }} />
                <SidebarItem icon={<ChefHat size={20}/>} label="Cocina" active={activeTab === 'kitchen'} onClick={() => { setActiveTab('kitchen'); setShowMobileMenu(false); }} />
                <SidebarItem icon={<UsersIcon size={20}/>} label="Clientes" active={activeTab === 'customers'} onClick={() => { setActiveTab('customers'); setShowMobileMenu(false); }} />
                
                {isAdmin && (
                   <>
                     <div className="pt-4 pb-2 px-2 text-xs font-bold text-gray-400 uppercase">Administración</div>
                     
                     {isSuperAdmin ? (
                        <SidebarItem icon={<Building2 size={20}/>} label="Clientes/Usuarios" active={activeTab === 'clients'} onClick={() => { setActiveTab('clients'); setShowMobileMenu(false); }} />
                     ) : (
                        <SidebarItem icon={<UserCog size={20}/>} label="Personal" active={activeTab === 'users'} onClick={() => { setActiveTab('users'); setShowMobileMenu(false); }} />
                     )}
                     
                     <SidebarItem icon={<CalendarClock size={20}/>} label="Reservas" active={activeTab === 'reservations'} onClick={() => { setActiveTab('reservations'); setShowMobileMenu(false); }} />
                     <SidebarItem icon={<Package size={20}/>} label="Inventario" active={activeTab === 'inventory'} onClick={() => { setActiveTab('inventory'); setShowMobileMenu(false); }} />
                     <SidebarItem icon={<HistoryIcon size={20}/>} label="Historial" active={activeTab === 'history'} onClick={() => { setActiveTab('history'); setShowMobileMenu(false); }} />
                   </>
                )}
             </nav>
             <button onClick={handleLogout} className="mt-4 flex items-center justify-center gap-2 text-red-500 w-full p-3 hover:bg-red-50 rounded-xl border border-red-100 font-medium"><LogOut size={20}/> Salir</button>
          </div>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 relative pt-16 md:pt-0">
        
        {activeTab === 'pos' && (
          <div className="flex h-full flex-col md:flex-row"> 
            <div className={`flex-1 overflow-y-auto p-4 md:p-6 ${mobileView === 'cart' ? 'hidden md:block' : 'block'}`}>
              <header className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar"> 
                {categories.map((cat) => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 transition-colors ${selectedCategory === cat ? 'bg-orange-600 text-white shadow-md' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>{cat}</button>
                ))}
              </header>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-24 md:pb-0"> 
                {selectedCategory !== 'Promociones' && filteredProducts.map((product) => (
                  <div key={product.id} onClick={() => addToCart(product)} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex justify-between items-center md:block md:p-4 hover:shadow-md cursor-pointer active:scale-95 duration-100 group">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 text-sm md:text-lg mb-1 group-hover:text-orange-600 transition-colors">{product.name}</h3>
                      <span className="text-[10px] md:text-xs bg-gray-50 px-2 py-1 rounded text-gray-500 border border-gray-100">{product.category}</span>
                    </div>
                    <div className="font-bold text-base md:text-xl text-orange-600 md:mt-2 whitespace-nowrap ml-2">$ {product.price.toLocaleString('es-AR')}</div>
                  </div>
                ))}
                {selectedCategory === 'Promociones' && promotions.map((promo) => (
                  <div key={promo.id} onClick={() => handleAddPromotionToCart(promo)} className="bg-purple-50 rounded-xl shadow-sm border border-purple-100 p-3 flex justify-between items-center md:block md:p-4 hover:shadow-md cursor-pointer active:scale-95 duration-100 group">
                    <div className="flex-1">
                      <h3 className="font-bold text-purple-900 text-sm md:text-lg mb-1 flex items-center gap-2"><Tag size={16}/> {promo.name}</h3>
                      <span className="text-[10px] md:text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded border border-purple-300 font-bold">{promo.discount_percentage}% OFF</span>
                    </div>
                    <div className="font-bold text-xs text-purple-600 md:mt-2 mt-0 ml-2">Click para agregar</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className={`md:hidden fixed bottom-6 left-4 right-4 z-30 transition-transform duration-300 ${mobileView === 'products' && cart.length > 0 ? 'translate-y-0' : 'translate-y-24'}`}>
                <button onClick={() => setMobileView('cart')} className="w-full bg-gray-900 text-white p-4 rounded-xl shadow-xl flex justify-between items-center font-bold text-lg">
                    <span className="bg-orange-500 px-3 py-1 rounded-lg text-sm">{cart.length} ítems</span><span>Ver Pedido</span><span>$ {finalTotal.toLocaleString()}</span>
                </button>
            </div>

            <aside className={`w-full md:w-96 bg-white md:border-l border-gray-200 flex flex-col h-full shadow-xl z-10 absolute md:static inset-0 ${mobileView === 'products' ? 'hidden md:flex' : 'flex'}`}>
              <div className="md:hidden p-4 border-b flex items-center gap-3">
                  <button onClick={() => setMobileView('products')} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button>
                  <span className="font-bold text-lg">Tu Pedido</span>
              </div>
              <div className="p-4 border-b border-gray-100 bg-gray-50 relative">
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Cliente</label>
                <div className="flex gap-2">
                  <div className="relative w-full">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={16} /></div>
                    <input type="text" placeholder="Buscar..." className="w-full pl-9 p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 bg-white text-sm" value={clientSearchTerm} onChange={(e) => { setClientSearchTerm(e.target.value); setShowClientDropdown(true); if(e.target.value === '') setSelectedCustomerId(''); }} onFocus={() => setShowClientDropdown(true)} />
                    {showClientDropdown && filteredCustomers.length > 0 && (
                      <div className="absolute w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-40 overflow-y-auto z-50">
                        {filteredCustomers.map(c => (
                          <div key={c.id} onClick={() => { setSelectedCustomerId(c.id); setClientSearchTerm(c.name); setShowClientDropdown(false); }} className="p-3 hover:bg-orange-50 cursor-pointer border-b border-gray-50 flex justify-between items-center text-sm">
                            <span className="font-medium text-gray-800">{c.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setShowQuickCustomer(true)} className="bg-white border border-gray-300 hover:border-orange-500 hover:text-orange-600 p-3 rounded-lg text-gray-500 flex-shrink-0 transition-colors"><UserPlus size={20}/></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-24 md:pb-4">
                {cart.length === 0 && <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-center"><ShoppingCart size={40} className="mb-2 opacity-20"/><p className="text-sm">Carrito vacío</p></div>}
                {cart.map((item) => (
                  <div key={item.cartId} className="flex justify-between items-center bg-white border border-gray-100 p-3 rounded-lg shadow-sm group hover:border-orange-200 transition-colors">
                    <div><p className="font-medium text-sm text-gray-800">{item.name}</p><p className="text-gray-500 text-xs">$ {item.price}</p></div>
                    <button onClick={() => removeFromCart(item.cartId)} className="text-gray-300 hover:text-red-500 p-2 transition-colors"><MinusCircle size={18}/></button>
                  </div>
                ))}
                {appliedDiscounts.length > 0 && <div className="mt-4 pt-4 border-t border-dashed"><p className="text-xs font-bold uppercase text-gray-500 mb-2">Descuentos Aplicados</p>{appliedDiscounts.map((d, i) => <div key={i} className="flex justify-between text-green-600 text-sm bg-green-50 p-2 rounded mb-1"><span>{d.name}</span><span>- ${d.amount}</span></div>)}</div>}
              </div>
              <div className="p-6 bg-white border-t md:relative fixed bottom-0 left-0 right-0 md:bottom-auto md:left-auto md:right-auto z-20 pb-8 md:pb-6 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                <div className="flex justify-between mb-4 text-2xl font-bold"><span>Total</span><span className="text-orange-600">$ {finalTotal.toLocaleString('es-AR')}</span></div>
                <button onClick={handleCheckout} disabled={cart.length === 0 || isProcessing} className="w-full bg-gray-900 hover:bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">{isProcessing ? 'Procesando...' : <><Receipt size={20}/> Confirmar Pedido</>}</button>
              </div>
            </aside>
          </div>
        )}

        {/* CONTENIDORES DE OTRAS SECCIONES */}
        <div className="flex-1 overflow-auto bg-gray-50">
            {activeTab === 'kitchen' && <Kitchen />}
            {activeTab === 'customers' && <Customers />}
            {isAdmin && activeTab === 'reservations' && <Reservations />}
            {isAdmin && activeTab === 'inventory' && <Inventory />}
            {isAdmin && activeTab === 'promos' && <Promotions />}
            {isAdmin && activeTab === 'history' && <History />}
            
            {/* LÓGICA DE VISTAS UNIFICADA */}
            {isSuperAdmin && activeTab === 'clients' && <Users />}
            {isAdmin && !isSuperAdmin && activeTab === 'users' && <Users />}
            
            {isAdmin && activeTab === 'reports' && <div className="p-10 text-center text-gray-500">Reportes en construcción...</div>}
        </div>

        {/* MODALES */}
        {showQuickCustomer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm">
              <h3 className="text-xl font-bold mb-4">Nuevo Cliente</h3>
              <input autoFocus className="w-full p-3 border rounded-lg mb-4 text-lg outline-none focus:ring-2 focus:ring-orange-500" placeholder="Nombre completo" value={quickCustomerName} onChange={e => setQuickCustomerName(e.target.value)} />
              <div className="flex gap-2"><button onClick={() => setShowQuickCustomer(false)} className="flex-1 py-3 text-gray-500 hover:bg-gray-50 rounded-lg">Cancelar</button><button onClick={handleQuickCustomerCreate} className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700">Guardar</button></div>
            </div>
          </div>
        )}

        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm">
              <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold flex items-center gap-2">🔑 Nueva Clave</h3><button onClick={() => setShowPasswordModal(false)}><X/></button></div>
              <input type="password" placeholder="Mínimo 6 caracteres" className="w-full p-3 border rounded-lg mb-4 outline-none focus:ring-2 focus:ring-orange-500" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <button onClick={handleChangePassword} className="w-full py-3 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700">Actualizar</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ==========================================
// COMPONENTES AUXILIARES (Icons & Helpers)
// ==========================================

function SidebarItem({ icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all font-medium text-sm mb-0.5 ${active ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-100 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
      <span className={active ? 'text-orange-600' : 'text-gray-400'}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function PizzaIcon({className}: {className?: string}) {
    return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M15 11h.01"/><path d="M11 15h.01"/><path d="M16.5 4a2.12 2.12 0 0 1 2.12 2.12 2.12 2.12 0 0 1-2.12 2.12 2.12 2.12 0 0 1-2.12-2.12A2.12 2.12 0 0 1 16.5 4z"/><path d="M21 21l-9-9"/><path d="M3 21l9-9"/><path d="M12 2L2 22h20L12 2z"/></svg>
}

function ShieldCheckIcon({className}: {className?: string}) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
}

export default App;