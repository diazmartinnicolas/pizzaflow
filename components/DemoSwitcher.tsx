import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, ChefHat, LayoutDashboard, ShieldCheck } from 'lucide-react';

interface DemoSwitcherProps {
  currentUserEmail: string | undefined;
  currentRole: string | undefined; // Si usas roles en tu app
}

export const DemoSwitcher = ({ currentUserEmail }: DemoSwitcherProps) => {
  const navigate = useNavigate();

  // SI NO ES EL USUARIO DEMO, NO MOSTRAMOS NADA (Invisible)
  if (currentUserEmail !== 'demo@pizzaflow.com') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <div className="bg-white/90 backdrop-blur border border-orange-200 shadow-2xl p-3 rounded-xl">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Modo Reclutador</span>
        </div>
        
        <div className="flex flex-col gap-2">
            <button 
                onClick={() => navigate('/cashier')} // Ajusta a tu ruta de caja
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-colors"
            >
                <Monitor className="w-4 h-4" /> Vista Cajero
            </button>

            <button 
                onClick={() => navigate('/kitchen')} // Ajusta a tu ruta de cocina
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-colors"
            >
                <ChefHat className="w-4 h-4" /> Vista Cocina
            </button>

            <button 
                onClick={() => navigate('/admin')} // Ajusta a tu ruta de admin
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-colors"
            >
                <LayoutDashboard className="w-4 h-4" /> Vista Admin
            </button>
        </div>
      </div>
    </div>
  );
};