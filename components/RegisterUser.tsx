import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../services/supabase'; // Tu cliente normal
import { UserPlus, Save, X } from 'lucide-react';

// Credenciales para la conexión temporal
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
      // 1. TRUCO: Crear un cliente temporal para no cerrar sesión al admin
      const tempSupabase = createClient(supabaseUrl, supabaseKey);

      // 2. Crear el usuario en Autenticación
      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("No se pudo crear el usuario");

      // 3. Guardar los datos extra (Nombre y Rol) en tu tabla 'users'
      // Usamos el cliente 'supabase' normal porque ese tiene permisos de Admin
      const { error: profileError } = await supabase
        .from('users') // Asegúrate de que tu tabla se llame 'users' o 'profiles'
        .insert([
          {
            id: authData.user.id, // Vinculamos con el ID de autenticación
            email: formData.email,
            name: formData.name,
            role: formData.role,
            active: true
          }
        ]);

      if (profileError) throw profileError;

      alert(`✅ Usuario ${formData.name} creado con éxito!`);
      onClose(); // Cerrar el formulario

    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        
        <div className="bg-gray-900 p-4 flex justify-between items-center">
          <h2 className="text-white font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-orange-500" />
            Nuevo Empleado
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleRegister} className="p-6 space-y-4">
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Nombre</label>
            <input
              required
              type="text"
              className="w-full border rounded p-2"
              placeholder="Ej: Juan Pérez"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
            <input
              required
              type="email"
              className="w-full border rounded p-2"
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
                className="w-full border rounded p-2"
                placeholder="******"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Rol</label>
              <select
                className="w-full border rounded p-2 bg-white"
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
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 mt-4"
          >
            {loading ? 'Creando...' : <><Save className="w-5 h-5" /> Guardar Empleado</>}
          </button>

        </form>
      </div>
    </div>
  );
};