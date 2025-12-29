import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { History as HistoryIcon, Search, Calendar, Filter, FileText, User, Tag, Lock } from 'lucide-react';

export default function History() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    
    // 1. Verificar identidad
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email || '';
    
    if (email.toLowerCase().includes('demo')) {
        setIsDemo(true);
        generateFakeLogs(); // Generar datos falsos
    } else {
        setIsDemo(false);
        fetchRealLogs(); // Buscar datos reales
    }
  };

  const fetchRealLogs = async () => {
    const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100); // Traemos los últimos 100 para no saturar

    if (error) {
        console.error("Error cargando historial:", error);
    } else {
        setLogs(data || []);
    }
    setLoading(false);
  };

  const generateFakeLogs = () => {
      // Simulador de datos para el Demo
      const actions = ['LOGIN', 'LOGOUT', 'VENTA', 'CREAR_CLIENTE', 'STOCK_UPDATE', 'ELIMINAR_USUARIO'];
      const users = ['demo@pizzaflow.com', 'cajero@pizzaflow.com', 'admin@pizzaflow.com'];
      const modules = ['Sistema', 'Caja', 'Clientes', 'Inventario', 'Usuarios'];
      
      const fakeData = Array.from({ length: 20 }).map((_, i) => {
          const randomAction = actions[Math.floor(Math.random() * actions.length)];
          return {
              id: `fake-${i}`,
              created_at: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toISOString(),
              user_email: users[Math.floor(Math.random() * users.length)],
              action: randomAction,
              details: `Simulación de acción ${randomAction} número #${Math.floor(Math.random() * 1000)}`,
              module: modules[Math.floor(Math.random() * modules.length)]
          };
      });
      
      // Ordenar por fecha
      fakeData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setLogs(fakeData);
      setLoading(false);
  };

  const filteredLogs = logs.filter(log => 
    log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActionColor = (action: string) => {
      if (action.includes('LOGIN')) return 'bg-green-100 text-green-700';
      if (action.includes('LOGOUT')) return 'bg-gray-100 text-gray-700';
      if (action.includes('VENTA')) return 'bg-blue-100 text-blue-700';
      if (action.includes('ELIMINAR')) return 'bg-red-100 text-red-700';
      if (action.includes('STOCK')) return 'bg-orange-100 text-orange-700';
      return 'bg-purple-100 text-purple-700';
  };

  if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Cargando historial de movimientos...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <HistoryIcon className="text-gray-600"/> Historial de Movimientos
        </h2>
        <div className="text-sm text-gray-400">
            Últimos 100 registros
        </div>
      </div>

      {isDemo && (
          <div className="mb-4 bg-orange-50 text-orange-800 p-3 rounded-lg flex items-center gap-2 text-sm border border-orange-200">
              <Lock size={16} />
              <span><strong>Modo Simulación:</strong> Estos datos son generados aleatoriamente para demostración.</span>
          </div>
      )}

      {/* Buscador */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por usuario, acción o detalle..." 
          className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Calendar size={14}/> Fecha / Hora</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase"><User size={14} className="inline mr-1"/>Usuario</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase"><Tag size={14} className="inline mr-1"/>Acción</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase"><Filter size={14} className="inline mr-1"/>Módulo</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase"><FileText size={14} className="inline mr-1"/>Detalle</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50 transition-colors text-sm">
                            <td className="p-4 whitespace-nowrap text-gray-600">
                                {new Date(log.created_at).toLocaleDateString()} <span className="text-gray-400">|</span> {new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </td>
                            <td className="p-4 font-medium text-gray-800">
                                {log.user_email}
                            </td>
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold border uppercase ${getActionColor(log.action)}`}>
                                    {log.action}
                                </span>
                            </td>
                            <td className="p-4 text-gray-500">
                                {log.module}
                            </td>
                            <td className="p-4 text-gray-600 max-w-md truncate" title={log.details}>
                                {log.details}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {filteredLogs.length === 0 && (
                <div className="p-12 text-center text-gray-400">
                    No se encontraron registros.
                </div>
            )}
        </div>
      </div>
    </div>
  );
}