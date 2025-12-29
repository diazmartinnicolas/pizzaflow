import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../services/supabase'; // Cliente principal (Admin actual)
import { UserPlus, Save, X } from 'lucide-react';

// Credenciales para crear el usuario (Auth) sin cerrar sesión al admin
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const RegisterUser = ({ onClose }: { onClose: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'kitchen' // 'kitchen' | 'cashier' | 'admin'
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Cliente temporal para crear el Auth User
      const tempSupabase = createClient(supabaseUrl, supabaseKey);

      // 2. Crear usuario en Auth
      // El Trigger SQL 'on_auth_user_created' creará automáticamente el perfil
      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("No se pudo crear el usuario en Auth.");

      // 3. Elevación de Privilegios Segura (RPC)
      // Si el rol elegido NO es 'cashier' (default), usamos RPC para actualizarlo
      if (formData.role !== 'cashier') {
        const { error: rpcError } = await supabase.rpc('admin_update_role', {
          target_user_id: authData.user.id,
          new_role: formData.role
        });

        if (rpcError) {
          console.error("Error asignando rol:", rpcError);
          alert(`Usuario creado, pero hubo un error asignando el rol: ${rpcError.message}`);
        }
      }

      alert(`✅ Usuario ${formData.name} creado exitosamente.`);
      onClose();

    } catch (error: any) {
      console.error(error);
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        
        <div className="bg-gray-900 p-4 flex justify-between items-center">
          <h2 className="text-white font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-orange-500" />
            Nuevo Empleado
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleRegister} className="p-6 space-y-4">
          
          <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-4">
            <p className="text-xs text-blue-700">
              <strong>Seguridad:</strong> El usuario será creado y el sistema asignará los permisos correspondientes.
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Nombre Completo</label>
            <input
              required
              type="text"
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 outline-none"
              placeholder="Ej: Juan Pérez"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Email Corporativo</label>
            <input
              required
              type="email"
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 outline-none"
              placeholder="juan@pizzaflow.com"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña</label>
              <input
                required
                type="password"
                minLength={6}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="Mínimo 6 chars"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Rol Asignado</label>
              <select
                className="w-full border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value})}
              >
                <option value="kitchen">Cocinero 👨‍🍳</option>
                <option value="cashier">Cajero 💰</option>
                <option value="admin">Admin 🛡️</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 mt-6 transition-colors shadow-lg disabled:opacity-50"
          >
            {loading ? 'Procesando...' : <><Save className="w-5 h-5" /> Guardar Empleado</>}
          </button>

        </form>
      </div>
    </div>
  );
};