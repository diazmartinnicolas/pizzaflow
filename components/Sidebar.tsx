import React, { useEffect, useState } from 'react';
import { ViewState, UserRole } from '../types';
import { useApp } from '../context/AppContext';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  ChefHat, 
  Package, 
  History, 
  Users, 
  LogOut,
  UserSquare2,
  TicketPercent,
  Download
} from 'lucide-react';

interface SidebarProps {
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const { currentUser, logout } = useApp();
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    // Show the install prompt
    installPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState; icon: any; label: string }) => (
    <button
      onClick={() => onViewChange(view)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        currentView === view 
          ? 'bg-orange-100 text-orange-700 font-semibold' 
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col hidden md:flex sticky top-0">
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-2xl font-bold text-orange-600 flex items-center gap-2">
          <span className="text-3xl">🍕</span> PizzaFlow
        </h2>
        <div className="mt-4 flex items-center gap-2 px-2 py-1 bg-gray-50 rounded text-sm">
           <div className="w-2 h-2 rounded-full bg-green-500"></div>
           <span className="text-gray-600 font-medium truncate">{currentUser?.name}</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <NavItem view="POS" icon={ShoppingCart} label="Punto de Venta" />
        <NavItem view="KITCHEN" icon={ChefHat} label="Cocina" />
        <NavItem view="CUSTOMERS" icon={UserSquare2} label="Clientes" />
        
        {/* Restricted Areas for Admin Only */}
        {currentUser?.role === UserRole.ADMIN && (
          <>
            <div className="my-2 border-t border-gray-100"></div>
            <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Administración</p>
            <NavItem view="INVENTORY" icon={Package} label="Inventario" />
            <NavItem view="PROMOTIONS" icon={TicketPercent} label="Promociones" />
            <NavItem view="HISTORY" icon={History} label="Historial" />
            <NavItem view="USERS" icon={Users} label="Usuarios" />
          </>
        )}
      </nav>

      <div className="p-4 border-t border-gray-200 space-y-2">
        {installPrompt && (
          <button
            onClick={handleInstallClick}
            className="w-full flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors shadow-sm mb-2"
          >
            <Download size={20} />
            <span>Instalar en PC</span>
          </button>
        )}

        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;