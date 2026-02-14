import { useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// Servicios
import { supabase } from './services/supabase';

// Contextos
import { useApp } from './context/AppContext';
import { CartProvider } from './context/CartContext';

// Hooks
import { useAuth } from './hooks/useAuth';

// Componentes - Páginas
import { Login } from './components/Login';
import POS from './components/POS';
import Kitchen from './components/Kitchen';
import Inventory from './components/Inventory';
import Customers from './components/Customers';
import Promotions from './components/Promotions';
import Users from './components/Users';
import History from './components/History';
import Reservations from './components/Reservations';
import Reports from './components/Reports';
import CashRegister from './components/CashRegister';
import TableLayout from './components/TableLayout';

// Componentes - UI
import { StatusOverlay } from './components/ui/StatusOverlay';
import { Button } from './components/atoms/Button';
import { ConnectionStatus } from './components/atoms/ConnectionStatus';

import {
  ShoppingCart, ChefHat, Users as UsersIcon, Package,
  History as HistoryIcon, UserCog, LogOut, CalendarClock, Menu,
  Crown, BarChart3, Briefcase, Lock, Building2, Flame, X, Tag, Calculator, LayoutGrid
} from 'lucide-react';

// ============================================================
// COMPONENTE: SidebarItem
// ============================================================

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  shortcut?: string;
}

function SidebarItem({ icon, label, active, onClick, shortcut }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center justify-between px-4 py-2.5 
        rounded-lg transition-all font-medium text-sm
        ${active
          ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-100 shadow-sm'
          : 'text-gray-600 hover:bg-gray-50'
        }
      `}
    >
      <div className="flex items-center gap-3">
        <span className={active ? 'text-orange-600' : 'text-gray-400'}>
          {icon}
        </span>
        <span>{label}</span>
      </div>
      {shortcut && (
        <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-400 border border-gray-200">
          {shortcut}
        </span>
      )}
    </button>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL: App
// ============================================================

function App() {
  const {
    session, userProfile, loading, signOut, refreshData,
    isOnline, pendingOrdersCount, syncPendingOrders
  } = useApp();

  // Hook de autenticación para permisos
  const auth = useAuth(session, userProfile);

  // Estado de navegación
  const [activeTab, setActiveTab] = useState('pos');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Estado para modo demo
  const [demoOrders, setDemoOrders] = useState<any[]>([]);

  // Estado para mesa seleccionada desde el salón (para agregar productos)
  const [tableForPOS, setTableForPOS] = useState<any>(null);
  const [orderToEdit, setOrderToEdit] = useState<any>(null);

  // Función para navegar al POS con una mesa
  const handleAddProductsToTable = (table: any, existingOrder: any) => {
    setTableForPOS({ table, existingOrder });
    setActiveTab('pos');
  };

  const handleEditOrder = (order: any) => {
    setOrderToEdit(order);
    setActiveTab('pos');
  };

  // ----------------------------------------------------------
  // EFECTOS
  // ----------------------------------------------------------

  // Resetear navegación cuando cambia el usuario
  useEffect(() => {
    // Cuando el session o userProfile cambia, resetear a la vista apropiada según el rol
    // Cocina va directo a kitchen, otros van a pos
    if (auth.isKitchen) {
      setActiveTab('kitchen');
    } else {
      setActiveTab('pos');
    }
    setShowMobileMenu(false);
  }, [session?.user?.id, auth.isKitchen]);

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

  // Escuchar eventos de recuperación de contraseña
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowPasswordModal(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ----------------------------------------------------------
  // HANDLERS
  // ----------------------------------------------------------

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Contraseña actualizada con éxito");
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (error: any) {
      toast.error("Error al actualizar contraseña: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDemoOrder = (order: any) => {
    setDemoOrders(prev => [order, ...prev]);
  };

  // ----------------------------------------------------------
  // ESTADOS DE CARGA Y AUTENTICACIÓN
  // ----------------------------------------------------------

  if (loading) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center bg-gray-50">
        <Flame className="w-12 h-12 text-orange-500 animate-spin opacity-50 mb-4" />
        <div className="text-orange-600 font-bold animate-pulse">Cargando Fluxo...</div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  // Bloqueo por empresa inactiva
  const isCompanyInactive = userProfile?.companies?.status === 'inactive';
  if (isCompanyInactive && !auth.isSuperAdmin) {
    return <StatusOverlay companyName={auth.companyName} onSignOut={signOut} />;
  }

  // ----------------------------------------------------------
  // RENDER PRINCIPAL
  // ----------------------------------------------------------

  return (
    <CartProvider>
      <div className="flex h-dvh bg-gray-50 font-sans text-gray-800 overflow-hidden">
        <Toaster position="top-right" richColors />

        {/* ========================================
            SIDEBAR (Desktop)
        ======================================== */}
        <aside className="w-64 bg-white border-r border-gray-200 flex-col justify-between hidden md:flex z-50">
          <div>
            {/* Header */}
            <div className="p-5 pb-2">
              <div className="flex items-center gap-3 mb-5">
                <Flame className="w-6 h-6 text-orange-600" />
                <h1 className="text-xl font-bold tracking-tight">Fluxo</h1>
              </div>

              {/* Rol del usuario */}
              <div className={`p-3 rounded-xl border mb-2 shadow-sm ${auth.isDemo ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'
                }`}>
                <span className="text-[10px] font-extrabold text-gray-400 uppercase">
                  {auth.isDemo ? 'MODO VISITA' : 'TU ROL'}
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  {auth.isSuperAdmin
                    ? <Crown className="w-3.5 h-3.5 text-yellow-500" />
                    : <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                  }
                  <span className="text-sm font-bold truncate">{auth.roleLabel}</span>
                </div>
              </div>
            </div>

            {/* Navegación */}
            <nav className="px-3 space-y-1">
              {/* Ventas - visible para admin, cajero, mozo */}
              {auth.canAccessPOS && (
                <SidebarItem icon={<ShoppingCart size={20} />} label="Ventas" active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} shortcut="F1" />
              )}

              {/* Cocina - visible para admin, cocina */}
              {auth.canAccessKitchen && (
                <SidebarItem icon={<ChefHat size={20} />} label="Cocina" active={activeTab === 'kitchen'} onClick={() => setActiveTab('kitchen')} shortcut="F2" />
              )}

              {/* Clientes - visible para admin, cajero, mozo (NO cocina) */}
              {auth.canAccessCustomers && (
                <SidebarItem icon={<UsersIcon size={20} />} label="Clientes" active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} shortcut="F3" />
              )}

              {/* Reservas - visible para admin, cajero, mozo (NO cocina) */}
              {auth.canAccessReservations && (
                <SidebarItem icon={<CalendarClock size={20} />} label="Reservas" active={activeTab === 'reservations'} onClick={() => setActiveTab('reservations')} shortcut="F4" />
              )}

              {/* Salón/Mesas - visible para admin, cajero, mozo (NO cocina) */}
              {(auth.isAdmin || auth.canAccessPOS) && (
                <SidebarItem icon={<LayoutGrid size={20} />} label="Salón" active={activeTab === 'tables'} onClick={() => setActiveTab('tables')} shortcut="F5" />
              )}

              {auth.isAdmin && (
                <>
                  <div className="h-px bg-gray-100 my-4" />
                  <SidebarItem
                    icon={auth.isSuperAdmin ? <Building2 size={20} /> : <UserCog size={20} />}
                    label={auth.isSuperAdmin ? "Panel Negocios" : "Personal"}
                    active={activeTab === 'users'}
                    onClick={() => setActiveTab('users')}
                  />
                  <SidebarItem icon={<Package size={20} />} label="Inventario" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
                  <SidebarItem icon={<Tag size={20} />} label="Promociones" active={activeTab === 'promotions'} onClick={() => setActiveTab('promotions')} />
                  <SidebarItem icon={<HistoryIcon size={20} />} label="Historial" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
                  <SidebarItem icon={<BarChart3 size={20} />} label="Reportes" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
                  <SidebarItem icon={<Calculator size={20} />} label="Caja" active={activeTab === 'cashregister'} onClick={() => setActiveTab('cashregister')} />
                </>
              )}
            </nav>
          </div>

          {/* Footer del Sidebar */}
          <div className="p-4 border-t space-y-2">
            {!auth.isDemo && (
              <button
                onClick={() => setShowPasswordModal(true)}
                className="flex items-center justify-center gap-2 w-full p-2.5 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all font-medium text-sm border border-gray-100"
              >
                <Lock size={18} /> Cambiar Contraseña
              </button>
            )}
            <button
              onClick={signOut}
              className="flex items-center justify-center gap-2 w-full p-2.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all font-medium text-sm border border-gray-100"
            >
              <LogOut size={18} /> Salir
            </button>
          </div>
        </aside>

        {/* ========================================
            HEADER MÓVIL
        ======================================== */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b flex items-center justify-between px-4 z-40">
          <button onClick={() => setShowMobileMenu(true)}>
            <Menu />
          </button>
          <div className="flex items-center gap-2 text-orange-600 font-bold">
            <Flame size={20} /> Fluxo
          </div>
          <div className="w-6" />
        </div>

        {/* ========================================
            CONTENIDO PRINCIPAL
        ======================================== */}
        <main className="flex-1 flex flex-col h-full overflow-hidden pt-16 md:pt-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full overflow-hidden"
            >
              {activeTab === 'pos' && (
                <POS
                  isDemo={auth.isDemo}
                  onDemoOrder={handleDemoOrder}
                  initialTable={tableForPOS}
                  editingOrder={orderToEdit}
                  onTableProcessed={() => setTableForPOS(null)}
                  onEditProcessed={() => setOrderToEdit(null)}
                />
              )}
              {activeTab === 'kitchen' && (
                <Kitchen
                  demoOrders={demoOrders}
                  onDemoComplete={id => setDemoOrders(prev => prev.filter(o => o.id !== id))}
                  onEditOrder={handleEditOrder}
                  companyName={auth.companyName}
                />
              )}
              {activeTab === 'customers' && <Customers />}
              {activeTab === 'reservations' && <Reservations />}
              {activeTab === 'inventory' && <Inventory onProductUpdate={refreshData} />}
              {activeTab === 'history' && <History />}
              {activeTab === 'reports' && <Reports />}
              {activeTab === 'promotions' && <Promotions />}
              {activeTab === 'users' && <Users />}
              {activeTab === 'cashregister' && <CashRegister />}
              {activeTab === 'tables' && <TableLayout onAddProducts={handleAddProductsToTable} />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* ========================================
            MODAL: Cambiar Contraseña
        ======================================== */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
            <div className="bg-white p-6 rounded-xl w-full max-w-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Actualizar Contraseña</h3>
                <button onClick={() => setShowPasswordModal(false)}>
                  <X className="text-gray-400" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-4 italic">
                Ingresa tu nueva contraseña para acceder a Fluxo con seguridad.
              </p>
              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <input
                  type="password"
                  className="w-full p-3 border rounded-lg"
                  placeholder="Nueva Contraseña (mín 6 car.)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  isLoading={isProcessing}
                >
                  {isProcessing ? 'Actualizando...' : 'Confirmar Cambio'}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================
            INDICADOR DE CONEXIÓN
        ======================================== */}
        <ConnectionStatus
          isOnline={isOnline}
          isSyncing={false}
          pendingCount={pendingOrdersCount}
          onSync={async () => {
            toast.info('Sincronizando pedidos pendientes...');
            const synced = await syncPendingOrders();
            if (synced > 0) {
              toast.success(`${synced} pedido(s) sincronizado(s)`);
            } else {
              toast.info('No hay pedidos pendientes para sincronizar');
            }
          }}
        />
      </div>
    </CartProvider>
  );
}

export default App;