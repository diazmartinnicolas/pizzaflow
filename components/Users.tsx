import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Shield, Trash, User, CheckCircle } from 'lucide-react';

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  useEffect(() => {
    fetchUsers();
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserEmail(user.email || '');
  };

  const fetchUsers = async () => {
    // Traemos todos los perfiles
    const { data, error } = await supabase.from('profiles').select('*').order('email');
    if (error) console.log("Error cargando usuarios:", error.message);
    if (data) setUsers(data);
  };

  const updateRole = async (id: string, newRole: string) => {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id);
    if (error) {
      alert("Error al actualizar rol");
    } else {
      fetchUsers();
    }
  };

  // Nota: Borrar usuarios de Auth requiere funciones de servidor (Edge Functions).
  // Por ahora, simularemos el borrado visual quitando permisos (poniéndolo inactivo o rol nulo).
  // Para este ejemplo, solo gestionaremos roles.

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Shield className="text-indigo-600"/> Gestión de Usuarios y Permisos
      </h2>

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6 text-sm text-blue-800">
        ℹ️ <strong>Cómo funciona:</strong> Pide a tus empleados que se registren en la pantalla de Login ("Sign Up").
        Aparecerán aquí automáticamente como "Cajeros". Tú puedes cambiarles el rol.
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="p-4">Email / Usuario</th>
              <th className="p-4">Rol Actual</th>
              <th className="p-4">Asignar Permisos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="p-4 font-medium flex items-center gap-2">
                  <div className="bg-gray-100 p-2 rounded-full"><User size={16}/></div>
                  {user.email}
                  {user.email === currentUserEmail && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 rounded-full">Tú</span>}
                </td>
                
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                    user.role === 'cocina' ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {user.role}
                  </span>
                </td>

                <td className="p-4">
                  {user.email !== currentUserEmail ? (
                    <select 
                      value={user.role} 
                      onChange={(e) => updateRole(user.id, e.target.value)}
                      className="border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="cajero">💵 Cajero (Ventas)</option>
                      <option value="cocina">👨‍🍳 Cocina (Solo Pantalla)</option>
                      <option value="admin">👑 Admin (Total)</option>
                    </select>
                  ) : (
                    <span className="text-gray-400 text-xs italic">No puedes cambiar tu propio rol</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}