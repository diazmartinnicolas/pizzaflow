import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Flame, ChefHat, ArrowRight, Lock } from 'lucide-react';
// 👇 IMPORTANTE: Importamos la lógica nueva de Demo
import { resetDemoData } from '../services/demo';
import { LoginSchema } from '../schemas/auth';
import { toast } from 'sonner';
import { z } from 'zod';

export const Login = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const validation = LoginSchema.safeParse({ email, password });
    if (!validation.success) {
      setError(validation.error.issues[0].message);
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Iniciar sesión (Usamos tus variables de entorno o un fallback)
      const demoEmail = import.meta.env.VITE_DEMO_EMAIL || 'demo@fluxo.com';
      const demoPass = import.meta.env.VITE_DEMO_PASSWORD || 'demo1234';

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPass,
      });

      if (authError) throw authError;

      // 2. EJECUTAR RESET LOCAL (CORRECCIÓN 🛠️)
      // En lugar de supabase.rpc, usamos tu nuevo archivo local
      if (data.user) {
        console.log("🔄 Iniciando reseteo LOCAL de Demo...");
        await resetDemoData(data.user.id);
      }

      console.log("¡Reseteo completado con éxito!");

      // 3. Recargar para ver los datos frescos
      window.location.reload();

    } catch (error: any) {
      console.error("Error en login demo:", error);
      setError("Error al ingresar con la demo: " + error.message);
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Por favor ingresa tu email para recuperar la contraseña");
      return;
    }

    if (email.toLowerCase() !== 'diazmartinnicolas@gmail.com') {
      setError("La recuperación por email solo está disponible para la cuenta principal del CEO.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const redirectUrl = window.location.origin;
      console.log("🔗 Solicitando recuperación con redirect_to:", redirectUrl);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      if (error) throw error;
      toast.success("Se ha enviado un enlace de recuperación a tu correo.");
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-700">

        {/* Header con Rebranding */}
        <div className="bg-orange-600 p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-white p-3 rounded-full shadow-lg">
              <Flame className="w-10 h-10 text-orange-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Fluxo</h1>
          <p className="text-orange-100">Sistema de Gestión Gastronómica</p>
        </div>

        {/* Body */}
        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">

            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded text-sm text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-gray-400 text-sm font-bold mb-2">Email Corporativo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg py-3 px-4 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                placeholder="admin@fluxo.com"
                required
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm font-bold mb-2">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg py-3 px-4 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none transition duration-300 flex items-center justify-center gap-2"
            >
              {loading ? 'Cargando...' : (
                <>
                  <Lock className="w-4 h-4" /> Iniciar Sesión
                </>
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-orange-400 hover:text-orange-300 text-sm font-medium transition-colors"
                disabled={loading}
              >
                ¿Olvidaste tu contraseña? (Solo CEO)
              </button>
            </div>
          </form>

          {/* Separador */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800 text-gray-500">¿Solo quieres mirar?</span>
            </div>
          </div>

          {/* BOTÓN DEMO */}
          <button
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-3 px-4 rounded-lg focus:outline-none transition duration-300 flex items-center justify-center gap-2"
          >
            <ChefHat className="w-5 h-5 text-orange-600" />
            Acceso Demo (Invitado)
            <ArrowRight className="w-4 h-4 ml-auto text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
};