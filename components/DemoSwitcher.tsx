import { RefreshCw, PlayCircle } from 'lucide-react';
import { supabase } from '../services/supabase';
// 👇 IMPORTANTE: Importamos la función del archivo nuevo
import { resetDemoData } from '../services/demo';

interface DemoSwitcherProps {
  isDemo: boolean;
  onToggle: () => void;
}

export const DemoSwitcher = ({ isDemo, onToggle }: DemoSwitcherProps) => {
  
  const handleReset = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Evita que el botón cambie de modo al hacer clic en reset
    
    console.log("📢 ESTOY USANDO EL CÓDIGO NUEVO");

    if (!confirm("¿Reiniciar datos de DEMO? Se borrarán los pedidos de prueba actuales.")) return;

    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 👇 AQUÍ ESTÁ LA CLAVE: Usamos la nueva función corregida
      await resetDemoData(user.id);
      
      alert("✅ Demo reiniciada con éxito.\nAhora verás un cliente cumpliendo años hoy.");
      window.location.reload(); // Recargamos para ver los cambios
    } catch (error: any) {
      // Si falla, mostramos el error técnico
      alert("Error reiniciando demo: " + error.message);
    }
  };

  return (
    <div 
      onClick={onToggle}
      className={`
        flex items-center gap-3 px-4 py-2 rounded-full cursor-pointer transition-all border
        ${isDemo 
          ? 'bg-orange-100 border-orange-300 text-orange-800 shadow-sm' 
          : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
        }
      `}
      title={isDemo ? "Estás en modo DEMO" : "Activar modo DEMO"}
    >
      <PlayCircle size={20} className={isDemo ? "fill-orange-500 text-orange-600" : ""} />
      
      <span className="font-bold text-sm select-none">
        {isDemo ? 'Modo DEMO' : 'Activar Demo'}
      </span>

      {isDemo && (
        <button 
          onClick={handleReset}
          className="ml-2 p-1.5 hover:bg-orange-200 rounded-full text-orange-600 transition-colors"
          title="Reiniciar datos de prueba"
        >
          <RefreshCw size={14} />
        </button>
      )}
    </div>
  );
};

