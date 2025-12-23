import { useState } from 'react';
import { supabase } from '../services/supabase';
import { Pizza, Loader2, UserPlus, LogIn } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Nuevo estado para saber si está intentando entrar o registrarse
  const [isRegistering, setIsRegistering] = useState(false);

  // CORRECCIÓN AQUÍ: Cambiamos "React.FormEvent" por "any" para evitar errores
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);

    if (isRegistering) {
      // --- MODO REGISTRO ---
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        alert("Error al registrarse: " + error.message);
      } else {
        if (data.session) {
          alert("¡Cuenta creada con éxito! Bienvenido al equipo.");
        } else {
          alert("¡Cuenta creada! Por favor revisa tu correo para confirmar (si está activada la confirmación).");
        }
      }
    } else {
      // --- MODO LOGIN (El normal) ---
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        alert("Error al ingresar: Credenciales incorrectas");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
        
        <div className="flex justify-center mb-6">
          <div className="bg-orange-100 p-4 rounded-full">
            <Pizza size={48} className="text-orange-600" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">PizzaFlow</h1>
        <p className="text-center text-gray-500 mb-8">
          {isRegistering ? 'Crear cuenta de empleado' : 'Gestión de Pizzería'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 text-white font-bold py-3 rounded-lg hover:bg-orange-700 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95"
          >
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : isRegistering ? (
              <> <UserPlus size={20} /> Registrarse </>
            ) : (
              <> <LogIn size={20} /> Ingresar </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center border-t pt-4">
          <p className="text-sm text-gray-600 mb-2">
            {isRegistering ? '¿Ya tienes cuenta?' : '¿Eres nuevo en el equipo?'}
          </p>
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-orange-600 font-bold hover:text-orange-800 text-sm transition-colors"
          >
            {isRegistering ? 'Volver a Iniciar Sesión' : 'Crear una cuenta nueva'}
          </button>
        </div>

      </div>
    </div>
  );
}