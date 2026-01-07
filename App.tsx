import { useEffect, useState, useRef } from 'react';
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
import Reports from './components/Reports';
import { calculateHalfHalfPrice } from './utils/pricing';



// Iconos

import { 

  ShoppingCart, ChefHat, Users as UsersIcon, Package, Percent, 

  History as HistoryIcon, UserCog, LogOut, MinusCircle, 

  UserPlus, Key, X, Search, CalendarClock, Menu, Receipt,

  LayoutDashboard, Monitor, Crown, BarChart3, Briefcase, Tag,

  Building2, Flame, Minus, Plus, Trash2,

  Banknote, QrCode, CreditCard, MapPin, Phone, Star, Split 

} from 'lucide-react';



// --- CONSTANTES DEMO ---

const DEMO_PRODUCTS = [

  { id: '1', name: 'Muzzarella (Demo)', price: 8000, category: 'Pizzas', active: true, is_favorite: true },

  { id: '2', name: 'Coca Cola 1.5L (Demo)', price: 2500, category: 'Bebidas', active: true, is_favorite: false },

  { id: '3', name: 'Empanada Carne (Demo)', price: 1200, category: 'Empanadas', active: true, is_favorite: false },

  { id: '4', name: 'Hamburguesa Completa (Demo)', price: 6500, category: 'Hamburguesas', active: true, is_favorite: true },

  { id: '5', name: 'Mitad Muzzarella (Demo)', price: 8000, category: 'Mitades', active: true, is_favorite: false },

  { id: '6', name: 'Mitad Especial (Demo)', price: 9500, category: 'Mitades', active: true, is_favorite: false },

];



function App() {

  const [session, setSession] = useState<any>(null);

  const [loading, setLoading] = useState(true);

  const [userRole, setUserRole] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState<string>(''); 



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

  

  // ESTADO NUEVO: Pedidos Demo

  const [demoOrders, setDemoOrders] = useState<any[]>([]);

  

  // ESTADOS VARIOS

  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);

  const [showQuickCustomer, setShowQuickCustomer] = useState(false);

  

  // DATOS COMPLETOS DE CLIENTE

  const [newClientData, setNewClientData] = useState({

    name: '',

    address: '',

    phone: ''

  });

  

  const [clientSearchTerm, setClientSearchTerm] = useState('');

  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [newPassword, setNewPassword] = useState('');

  const [showMobileMenu, setShowMobileMenu] = useState(false); 

  

  // ESTADO: FORMA DE PAGO

  const [paymentType, setPaymentType] = useState('efectivo');



  // --- ESTADO: SELECCIÓN DE MITADES ---

  const [firstHalf, setFirstHalf] = useState<any>(null);

  

  // Ref para cerrar dropdown al hacer click afuera

  const searchContainerRef = useRef<HTMLDivElement>(null);



  // Lógica de Permisos

  const currentUserEmail = session?.user?.email?.toLowerCase().trim() || '';

  const isDemo = currentUserEmail.includes('demo');

  const isSuperAdmin = userRole === 'super_admin';

  const isAdmin = userRole === 'admin' || userRole === 'super_admin' || isDemo;



  // --- CATEGORÍAS ---

  const categories = ['Todo', 'Promociones', 'Pizzas', 'Milanesas', 'Hamburguesas', 'Empanadas', 'Ensaladas', 'Mitades', 'Bebidas', 'Postres'];



  // ==============================================================================

  // 1. EFECTOS Y CARGA DE DATOS

  // ==============================================================================



  // Hook para detectar click afuera del buscador

  useEffect(() => {

    function handleClickOutside(event: MouseEvent) {

      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {

        setShowClientDropdown(false);

      }

    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {

      document.removeEventListener("mousedown", handleClickOutside);

    };

  }, [searchContainerRef]);



  // ==============================================================================

  // SEGURIDAD: RESETEO AUTOMÁTICO AL CAMBIAR DE USUARIO

  // ==============================================================================

  useEffect(() => {

    setCart([]);

    setCustomers([]);

    setSelectedCustomerId('');

    setClientSearchTerm('');

    setMobileView('products');

    setDemoOrders([]);

    setIsProcessing(false);

    setPaymentType('efectivo');

    setFirstHalf(null); 

    

    console.log("♻️ Sesión cambiada: Estado limpiado por seguridad.");

  }, [session?.user?.id]);



  // GESTIÓN DE SESIÓN Y SEGURIDAD

  useEffect(() => {

    supabase.auth.getSession().then(({ data: { session } }) => {

      setSession(session);

      if (session) {

          fetchUserRole(session); 

      } else {

          setLoading(false);

      }

    });



    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {

      setSession(session);

      

      if (event === 'SIGNED_IN' && session) {

          setLoading(true);

          setCart([]); 

          logAction('LOGIN', 'Inicio de sesión exitoso', 'Sistema');

          fetchUserRole(session);

      } else if (event === 'SIGNED_OUT' || !session) {

          setUserRole(null); 

          setCompanyName('');

          setCart([]); 

          setCustomers([]); 

          setSelectedCustomerId('');

          setLoading(false);

      }

    });



    return () => subscription.unsubscribe();

  }, []);



  const fetchUserRole = async (currentSession: any) => {

    const userId = currentSession.user.id;

    const email = currentSession.user.email;



    if (email === 'diazmartinnicolas@gmail.com') {

         console.log("👑 Super Admin (CEO) detectado por email.");

         setUserRole('super_admin');

         setCompanyName('Fluxo Global');

         await fetchData(); 

         setLoading(false);

         return; 

    }



    if (email?.toLowerCase().includes('demo')) {

        setUserRole('admin');

        setCompanyName('Modo Demo');

        await fetchData(true); 

        setLoading(false);

        return;

    }



    try {

        const metaRole = currentSession.user.user_metadata?.role || currentSession.user.app_metadata?.role;

        

        if (metaRole === 'super_admin') {

            console.log("🚀 Super Admin detectado vía Metadata.");

            setUserRole('super_admin');

            setCompanyName('Global Admin');

            fetchData();

            setLoading(false);

            return; 

        }



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

        

        if (!data) {

            console.error("⛔ SEGURIDAD: Usuario sin perfil detectado.");

            alert("⛔ ACCESO DENEGADO\n\nTu usuario ha sido eliminado del sistema.");

            await supabase.auth.signOut();

            setSession(null); 

            setLoading(false); 

            return;

        }



        const company: any = data.companies; 

        

        if (company && company.status === 'inactive') {

            console.warn(`⛔ SEGURIDAD: Empresa ${company.name} inactiva.`);

            alert(`⚠️ CUENTA SUSPENDIDA\n\nLa suscripción de "${company.name}" se encuentra inactiva.`);

            await supabase.auth.signOut();

            setSession(null); 

            setLoading(false); 

            return;

        }



        console.log("✅ Acceso concedido. Rol:", data.role);

        setUserRole(data.role);

        

        if (company && company.name) {

            setCompanyName(company.name);

        }



        if (data.role === 'cocina') setActiveTab('kitchen');



        await fetchData();



    } catch (error) {

        console.error("Error crítico validando usuario:", error);

        alert("Error de conexión validando credenciales.");

        await supabase.auth.signOut();

        setSession(null);

    }

    setLoading(false);

  };



  const fetchData = async (forceDemo = false) => {

    if (isDemo || forceDemo) {

        console.log("Modo Demo: Cargando datos locales...");

        setProducts(DEMO_PRODUCTS);

        setCustomers([{ id: 'd1', name: 'Cliente Mostrador' }, { id: 'd2', name: 'Mesa 4' }]);

        setPromotions([]);

        return; 

    }



    try {

        const { data: prodData } = await supabase.from('products').select('*'); 

        if (prodData) setProducts(prodData);



        // En App.tsx, dentro de fetchData:

        const { data: promoData } = await supabase
            .from('promotions')
            .select('*')
            .is('deleted_at', null); // <--- ESTO ES LO QUE FALTA

        if (promoData) setPromotions(promoData);



        // --- ACTUALIZADO: Filtrar solo clientes activos (Soft Delete) ---

        const { data: clientData } = await supabase.from('clients')

            .select('*')

            .eq('is_active', true)

            .order('name');

        

        if (clientData) {

             setCustomers(clientData);

        }

    } catch (error) { console.error(error); }

  };



  // ==============================================================================

  // 2. HELPERS Y CÁLCULOS

  // ==============================================================================



  const getRoleLabel = () => {

    if (isDemo) return 'Usuario Demo';

    const role = userRole?.toLowerCase();

    

    let label = 'Usuario';

    if (role === 'super_admin') label = 'CEO / Super Admin';

    else if (role === 'admin') label = 'Administrador';

    else if (role === 'cashier' || role === 'cajero') label = 'Cajero';

    else if (role === 'cocina') label = 'Cocina';



    if (companyName && role !== 'super_admin') {

        return `${label} (${companyName})`;

    }

    return label;

  };



  const addToCart = (product: any) => {

    setCart(currentCart => [...currentCart, { ...product, cartId: Date.now() + Math.random() }]);

    if (navigator.vibrate) navigator.vibrate(50);

  };



  // --- LOGICA DE MITADES UNIFICADA (CORREGIDA) ---

  const handleProductClick = (product: any) => {    

    // CORRECCIÓN 1: Detección inteligente por Categoría O Nombre

    const isHalf = product.category === 'Mitades' || product.name.toLowerCase().includes('mitad');

    // CASO A: Producto normal (no es mitad)
    if (!isHalf) {
        addToCart(product);
        return;
    }

    // CASO B: Es Mitad, Click 1 (Guardar en memoria)
    if (!firstHalf) {
        setFirstHalf(product);
        if (navigator.vibrate) navigator.vibrate(50);
        return;
    }

    // CASO C: Es Mitad, Click 2 (Combinar y Agregar)
    const secondHalf = product;    

    // Regla de Negocio: Cobrar la más cara de las dos

    const finalPrice = calculateHalfHalfPrice(firstHalf.price, secondHalf.price);

    

    // Crear nombre combinado

    const name1 = firstHalf.name.replace(/Mitad /i, '').trim();

    const name2 = secondHalf.name.replace(/Mitad /i, '').trim();

    const combinedName = `Pizza Comb.: ${name1} / ${name2}`;



    const combinedProduct = {

        ...firstHalf, 

        id: `combo-${Date.now()}`, 

        name: combinedName,

        price: finalPrice,

        category: 'Pizzas', 

        is_combo: true 

    };



    addToCart(combinedProduct);

    setFirstHalf(null); 

  };



  const removeFromCart = (cartId: number) => setCart(cart.filter(item => item.cartId !== cartId));



  const decreaseQuantity = (productId: string) => {

    const itemIndex = cart.findIndex(item => item.id === productId);

    if (itemIndex !== -1) {

        const newCart = [...cart];

        newCart.splice(itemIndex, 1);

        setCart(newCart);

    }

  };



  const removeGroupFromCart = (productId: string) => {

    setCart(cart.filter(item => item.id !== productId));

  };



  const handleAddPromotionToCart = (promo: any) => {

      const product1 = products.find(p => p.id === promo.product_1_id);

      if (product1) addToCart(product1);

      if (promo.product_2_id) {

          const product2 = products.find(p => p.id === promo.product_2_id);

          if (product2) setTimeout(() => addToCart(product2), 50); 

      } else {

          if (promo.name.toLowerCase().includes('2x1') || promo.type === '2x1') {

             addToCart(product1); 

          }

      }

  };



  const getFilteredProducts = () => {

    let result = products;



    if (selectedCategory === 'Mitades') {

        result = result.filter(p => p.name.toLowerCase().includes('mitad') || p.category === 'Mitades');

    } else if (selectedCategory !== 'Todo') {

        result = result.filter(p => p.category === selectedCategory);

    }



    result = result.sort((a, b) => {

        if (a.is_favorite === true && b.is_favorite !== true) return -1;

        if (a.is_favorite !== true && b.is_favorite === true) return 1;

        return 0; 

    });



    return result;

  };



  const filteredProducts = getFilteredProducts();



  const calculateTotals = () => {

    let tempCart = [...cart];

    let appliedDiscounts: any[] = [];

    let subtotal = cart.reduce((sum, item) => sum + item.price, 0);



    promotions.forEach(promo => {

      let guard = 0;

      while (guard < 100) {

        guard++;



        const index1 = tempCart.findIndex(item => item.id === promo.product_1_id);

        if (index1 === -1) break;



        if (promo.product_2_id) {

          const index2 = tempCart.findIndex((item, idx) => item.id === promo.product_2_id && idx !== index1);

          

          if (index2 !== -1) {

            const amount = (tempCart[index1].price + tempCart[index2].price) * (promo.discount_percentage / 100);

            appliedDiscounts.push({ name: promo.name, amount });

            const idsToRemove = [tempCart[index1].cartId, tempCart[index2].cartId];

            tempCart = tempCart.filter(item => !idsToRemove.includes(item.cartId));

          } else {

            break;

          }

        } 

        else {

          const is2x1 = promo.type === '2x1' || promo.name.toLowerCase().includes('2x1');



          if (is2x1) {

             const index2 = tempCart.findIndex((item, idx) => item.id === promo.product_1_id && idx !== index1);

             if (index2 !== -1) {

                const totalPrice = tempCart[index1].price + tempCart[index2].price;

                const amount = totalPrice * (promo.discount_percentage / 100);

                appliedDiscounts.push({ name: promo.name, amount });

                const idsToRemove = [tempCart[index1].cartId, tempCart[index2].cartId];

                tempCart = tempCart.filter(item => !idsToRemove.includes(item.cartId));

             } else {

                break;

             }

          } else {

             const amount = tempCart[index1].price * (promo.discount_percentage / 100);

             appliedDiscounts.push({ name: promo.name, amount });

             const idToRemove = tempCart[index1].cartId;

             tempCart = tempCart.filter(item => item.cartId !== idToRemove);

          }

        }

      }

    });

    const totalDiscount = appliedDiscounts.reduce((sum, d) => sum + d.amount, 0);

    return { subtotal, totalDiscount, finalTotal: subtotal - totalDiscount, appliedDiscounts };

  };



  const { finalTotal, appliedDiscounts } = calculateTotals();

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()));



  const groupedCart = Object.values(cart.reduce((acc: any, item: any) => {

    if (!acc[item.id]) {

      acc[item.id] = { ...item, quantity: 0, subtotalPrice: 0 };

    }

    acc[item.id].quantity += 1;

    acc[item.id].subtotalPrice += item.price;

    return acc;

  }, {}));



  // ==============================================================================

  // 3. HANDLERS

  // ==============================================================================



  const handleToggleFavorite = async (e: React.MouseEvent, product: any) => {

    e.stopPropagation(); 

    const newStatus = !product.is_favorite;

    setProducts(prev => prev.map(p => p.id === product.id ? {...p, is_favorite: newStatus} : p));



    if (isDemo) return; 



    try {

        const { error } = await supabase

            .from('products')

            .update({ is_favorite: newStatus })

            .eq('id', product.id);

        

        if (error) {

            console.error(error);

            setProducts(prev => prev.map(p => p.id === product.id ? {...p, is_favorite: !newStatus} : p));

        }

    } catch (err) { console.error(err); }

  };



  const handleCheckout = async () => {

    if (cart.length === 0) return;

    if (!selectedCustomerId) return alert("Selecciona un cliente.");

    setIsProcessing(true);



    if (isDemo) {

        setTimeout(() => {

            const fakeTicket = Math.floor(Math.random() * 1000) + 1000;

            const fakeOrder = {

                id: Date.now(),

                ticket_number: fakeTicket,

                created_at: new Date().toISOString(),

                status: 'pendiente',

                client: { name: clientSearchTerm || 'Cliente Demo' },

                order_items: cart.map(item => ({ product: { name: item.name }, quantity: 1 }))

            };

            setDemoOrders(prev => [fakeOrder, ...prev]);

            alert(`(Simulación) Ticket #${fakeTicket} enviado a Cocina correctamente.`);

            setCart([]); setSelectedCustomerId(''); setClientSearchTerm(''); setMobileView('products'); setIsProcessing(false); setPaymentType('efectivo');

        }, 600); 

        return; 

    }



    if (!session || !session.user || !session.user.id) {

        alert("Error crítico: No se detectó la sesión del usuario.");

        setIsProcessing(false);

        return;

    }



    try {

      const { data: orderData, error: orderError } = await supabase.from('orders').insert([{ 

          client_id: selectedCustomerId, 

          total: finalTotal, 

          status: 'pendiente', 

          payment_type: paymentType, 

          user_id: session.user.id 

      }]).select().single();

      

      if (orderError) throw orderError;



      const itemCounts: any = {};

      cart.forEach(item => { itemCounts[item.id] = (itemCounts[item.id] || 0) + 1; });

      const orderItems = Object.keys(itemCounts).map(productId => {

        const product = products.find(p => p.id === productId);

        

        const isCombo = productId.toString().startsWith('combo-');

        const fallbackId = products.find(p => p.category === 'Pizzas')?.id || products[0]?.id;



        return { 

            order_id: orderData.id, 

            product_id: isCombo ? fallbackId : productId, 

            quantity: itemCounts[productId], 

            price_at_moment: isCombo ? cart.find(c=>c.id === productId)?.price : product?.price 

        };

      });

      

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

      if (itemsError) throw itemsError;

      

      await logAction('VENTA', `Ticket #${orderData.ticket_number} - $${finalTotal} (${paymentType})`, 'Caja');

      alert(`¡Ticket #${orderData.ticket_number || 'OK'} enviado!`);

      

      setCart([]); 

      setSelectedCustomerId(''); 

      setClientSearchTerm(''); 

      setMobileView('products');

      setPaymentType('efectivo');



    } catch (error: any) { alert("Error: " + error.message); } 

    finally { setIsProcessing(false); }

  };



  const handleQuickCustomerCreate = async () => {

    if(!newClientData.name.trim()) return alert("El nombre es obligatorio.");



    if (isDemo) { 

        const fakeId = `temp-${Date.now()}`;

        const fakeClient = { id: fakeId, ...newClientData };

        setCustomers(prev => [...prev, fakeClient]);

        

        setSelectedCustomerId(fakeId); 

        setClientSearchTerm(fakeClient.name);

        

        setShowQuickCustomer(false); 

        setNewClientData({ name: '', address: '', phone: '' });

        alert("(Demo) Cliente creado en memoria."); 

        return; 

    }



    try {

        const { data, error } = await supabase.from('clients').insert([{ 

            name: newClientData.name, 

            address: newClientData.address,

            phone: newClientData.phone,

            user_id: session.user.id 

        }]).select().single();



        if (error) throw error;

        

        await logAction('CREAR_CLIENTE', `Rápido: ${data.name}`, 'Clientes');

        

        setCustomers([data, ...customers]); 

        setSelectedCustomerId(data.id); 

        setClientSearchTerm(data.name); 

        

        setShowQuickCustomer(false); 

        setNewClientData({ name: '', address: '', phone: '' });

    } catch (error: any) { alert("Error: " + error.message); }

  };



  const handleLogout = async () => {

    await logAction('LOGOUT', 'Usuario cerró sesión', 'Sistema');

    await supabase.auth.signOut();

    setSession(null);

  };



  const handleChangePassword = async () => {

    if (newPassword.length < 6) return alert("Mínimo 6 caracteres.");

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) alert("Error: " + error.message);

    else { alert("¡Contraseña actualizada!"); setShowPasswordModal(false); setNewPassword(''); }

  };



  // ==============================================================================

  // 4. RENDERIZADO

  // ==============================================================================



  if (loading) {

      return (

        <div className="h-dvh flex flex-col items-center justify-center bg-gray-50">

            <div className="animate-spin mb-4"><Flame className="w-12 h-12 text-orange-500 opacity-50" /></div>

            <div className="text-orange-600 font-bold animate-pulse text-lg">Cargando Fluxo...</div>

        </div>

      );

  }



  if (!session) return <Login />;



  if (userRole === 'cocina') {

    return (

      <div className="h-dvh flex flex-col bg-gray-900">

        <div className="bg-gray-800 text-white p-4 flex justify-between items-center safe-area-top">

          <h1 className="font-bold text-xl flex items-center gap-2">👨‍🍳 Cocina</h1>

          <button onClick={handleLogout} className="text-red-300"><LogOut size={20}/></button>

        </div>

        <div className="flex-1 overflow-hidden">

            <Kitchen demoOrders={demoOrders} onDemoComplete={(id: any) => setDemoOrders(prev => prev.filter(o => o.id !== id))} companyName={companyName} />

        </div>

      </div>

    );

  }



  return (

    <div className="flex h-dvh bg-gray-50 font-sans text-gray-800 overflow-hidden">

      

      {/* SIDEBAR DESKTOP */}

      <aside className="w-64 bg-white border-r border-gray-200 flex-col justify-between hidden md:flex z-50">

        <div>

          <div className="p-5 pb-2">

            <div className="flex items-center gap-3 mb-5">

              <div className="bg-orange-100 p-2 rounded-full"><Flame className="w-6 h-6 text-orange-600" /></div>

              <h1 className="text-xl font-bold text-gray-800 tracking-tight">Fluxo</h1>

            </div>



            <div className={`flex items-center justify-between px-3 py-3 rounded-xl border mb-2 shadow-sm transition-all ${isDemo ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200' : 'bg-white border-gray-200'}`}>

              <div className="flex flex-col w-full overflow-hidden">

                <span className={`text-[10px] font-extrabold tracking-wider uppercase mb-0.5 ${isDemo ? 'text-orange-600' : 'text-gray-400'}`}>

                  {isDemo ? 'MODO VISITA' : 'TU ROL'}

                </span>

                <div className="flex items-start gap-1.5"> 

                  {isDemo ? <Monitor className="w-3.5 h-3.5 text-orange-700 flex-shrink-0 mt-0.5" /> : 

                   isSuperAdmin ? <ShieldCheckIcon className="w-3.5 h-3.5 text-purple-600 flex-shrink-0 mt-0.5" /> :

                   userRole === 'admin' ? <Crown className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" /> :

                   <Briefcase className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />}

                  

                  <span className={`text-sm font-bold whitespace-normal leading-tight break-words ${isDemo ? 'text-orange-800' : 'text-gray-800'}`} title={getRoleLabel()}>

                    {getRoleLabel()}

                  </span>

                </div>

              </div>

              {!isDemo && (

                <button onClick={() => setShowPasswordModal(true)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-gray-50 rounded-lg transition-colors flex-shrink-0"><Key className="w-4 h-4" /></button>

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

                      label="Usuarios" 

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

                        <SidebarItem icon={<Building2 size={20}/>} label="Usuarios" active={activeTab === 'clients'} onClick={() => { setActiveTab('clients'); setShowMobileMenu(false); }} />

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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-24 md:pb-24"> 

                {selectedCategory !== 'Promociones' && filteredProducts.map((product) => (

                  <div key={product.id} onClick={() => handleProductClick(product)} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex justify-between items-center md:block md:p-4 hover:shadow-md cursor-pointer active:scale-95 duration-100 group relative">

                    

                    {/* BOTÓN FAVORITO */}

                    <button 

                        onClick={(e) => handleToggleFavorite(e, product)}

                        className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-gray-100 z-10 transition-colors"

                    >

                        <Star 

                            size={18} 

                            className={product.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-gray-300 hover:text-yellow-400"} 

                        />

                    </button>



                    <div className="flex-1">

                      <h3 className="font-bold text-gray-800 text-sm md:text-lg mb-1 group-hover:text-orange-600 transition-colors pr-6">{product.name}</h3>

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

            

            {/* INDICADOR FLOTANTE DE MITAD SELECCIONADA */}

            {firstHalf && (

                <div className="absolute bottom-4 left-4 right-4 md:bottom-auto md:top-4 md:left-6 md:right-auto md:w-96 z-40 animate-in slide-in-from-bottom-4">

                    <div className="bg-gray-900 text-white p-3 rounded-xl shadow-xl flex items-center justify-between gap-3 border border-gray-700">

                        <div className="flex items-center gap-3 overflow-hidden">

                            <div className="bg-blue-600 p-2 rounded-lg animate-pulse">

                                <Split size={20} className="text-white"/>

                            </div>

                            <div className="flex flex-col overflow-hidden">

                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Eligiendo 2da Mitad</span>

                                <span className="font-bold truncate text-sm">1/2 {firstHalf.name}</span>

                            </div>

                        </div>

                        <button onClick={() => setFirstHalf(null)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors">

                            <X size={18}/>

                        </button>

                    </div>

                </div>

            )}



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

                  <div className="relative w-full" ref={searchContainerRef}>

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

                {groupedCart.map((item: any) => (

                  <div key={item.id} className="bg-white border border-gray-100 p-3 rounded-lg shadow-sm group hover:border-orange-200 transition-colors">

                    <div className="flex justify-between items-start mb-2">

                      <p className="font-medium text-sm text-gray-800 leading-tight">{item.name}</p>

                      <p className="font-bold text-gray-700 text-sm whitespace-nowrap ml-2">$ {item.subtotalPrice.toLocaleString('es-AR')}</p>

                    </div>



                    <div className="flex items-center justify-between">

                       <div className="flex items-center gap-3">

                         <button onClick={() => decreaseQuantity(item.id)} className="w-7 h-7 flex items-center justify-center bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"><Minus size={14} /></button>

                         <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>

                         <button onClick={() => addToCart(item)} className="w-7 h-7 flex items-center justify-center bg-orange-100 text-orange-600 rounded hover:bg-orange-200 transition-colors"><Plus size={14} /></button>

                       </div>

                       <button onClick={() => removeGroupFromCart(item.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Eliminar producto"><Trash2 size={16} /></button>

                    </div>

                  </div>

                ))}

                {appliedDiscounts.length > 0 && <div className="mt-4 pt-4 border-t border-dashed"><p className="text-xs font-bold uppercase text-gray-500 mb-2">Descuentos Aplicados</p>{appliedDiscounts.map((d, i) => <div key={i} className="flex justify-between text-green-600 text-sm bg-green-50 p-2 rounded mb-1"><span>{d.name}</span><span>- ${d.amount}</span></div>)}</div>}

              </div>

              <div className="p-6 bg-white border-t md:relative fixed bottom-0 left-0 right-0 md:bottom-auto md:left-auto md:right-auto z-20 pb-8 md:pb-6 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">

                

                {/* SELECTOR DE FORMA DE PAGO */}

                <div className="grid grid-cols-3 gap-2 mb-4">

                    <button onClick={() => setPaymentType('efectivo')} className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${paymentType === 'efectivo' ? 'bg-gray-800 text-white border-gray-800 ring-2 ring-gray-200' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>

                        <Banknote size={18} className="mb-1"/>

                        <span className="text-[10px] font-bold uppercase">Efectivo</span>

                    </button>

                    <button onClick={() => setPaymentType('transferencia')} className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${paymentType === 'transferencia' ? 'bg-gray-800 text-white border-gray-800 ring-2 ring-gray-200' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>

                        <QrCode size={18} className="mb-1"/>

                        <span className="text-[10px] font-bold uppercase">Transf.</span>

                    </button>

                    <button onClick={() => setPaymentType('tarjeta')} className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${paymentType === 'tarjeta' ? 'bg-gray-800 text-white border-gray-800 ring-2 ring-gray-200' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>

                        <CreditCard size={18} className="mb-1"/>

                        <span className="text-[10px] font-bold uppercase">Tarjeta</span>

                    </button>

                </div>



                <div className="flex justify-between mb-4 text-2xl font-bold"><span>Total</span><span className="text-orange-600">$ {finalTotal.toLocaleString('es-AR')}</span></div>

                <button onClick={handleCheckout} disabled={cart.length === 0 || isProcessing} className="w-full bg-gray-900 hover:bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">{isProcessing ? 'Procesando...' : <><Receipt size={20}/> Confirmar Pedido</>}</button>

              </div>

            </aside>

          </div>

        )}



        {/* CONTENIDORES DE OTRAS SECCIONES */}

        <div className="flex-1 overflow-auto bg-gray-50">

            {activeTab === 'kitchen' && (

                <Kitchen 

                    demoOrders={demoOrders} 

                    onDemoComplete={(id: any) => setDemoOrders(prev => prev.filter(o => o.id !== id))} 

                    companyName={companyName} 

                />

            )}

            {activeTab === 'customers' && <Customers />}

            {isAdmin && activeTab === 'reservations' && <Reservations />}

            {isAdmin && activeTab === 'inventory' && <Inventory />}

            {isAdmin && activeTab === 'promos' && <Promotions />}

            {isAdmin && activeTab === 'history' && <History />}

            

            {isSuperAdmin && activeTab === 'clients' && <Users />}

            {isAdmin && !isSuperAdmin && activeTab === 'users' && <Users />}

            

            {isAdmin && activeTab === 'reports' && <Reports />}

        </div>



        {/* --- MODAL NUEVO CLIENTE --- */}

        {showQuickCustomer && (

          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in">

            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm">

              <div className="flex justify-between items-center mb-4">

                  <h3 className="text-xl font-bold">Nuevo Cliente</h3>

                  <button onClick={() => setShowQuickCustomer(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>

              </div>

              

              <div className="space-y-3 mb-6">

                  {/* INPUT NOMBRE */}

                  <div className="relative">

                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><UsersIcon size={18} /></div>

                      <input 

                        autoFocus 

                        className="w-full pl-10 p-3 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500" 

                        placeholder="Nombre Completo" 

                        value={newClientData.name} 

                        onChange={e => setNewClientData({...newClientData, name: e.target.value})} 

                      />

                  </div>



                  {/* INPUT DIRECCIÓN */}

                  <div className="relative">

                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><MapPin size={18} /></div>

                      <input 

                        className="w-full pl-10 p-3 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500" 

                        placeholder="Dirección / Altura" 

                        value={newClientData.address} 

                        onChange={e => setNewClientData({...newClientData, address: e.target.value})} 

                      />

                  </div>



                  {/* INPUT TELÉFONO */}

                  <div className="relative">

                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Phone size={18} /></div>

                      <input 

                        type="tel"

                        className="w-full pl-10 p-3 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500" 

                        placeholder="Teléfono / WhatsApp" 

                        value={newClientData.phone} 

                        onChange={e => setNewClientData({...newClientData, phone: e.target.value})} 

                      />

                  </div>

              </div>



              <div className="flex gap-2">

                  <button onClick={() => setShowQuickCustomer(false)} className="flex-1 py-3 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors font-medium">Cancelar</button>

                  <button onClick={handleQuickCustomerCreate} className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors shadow-sm">Guardar</button>

              </div>

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