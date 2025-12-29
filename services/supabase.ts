/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// 1. Lectura y Limpieza (Trim) para evitar errores de espacios en blanco
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// 2. Diagnóstico en Consola (Solo verás esto en F12 -> Console)
// Esto te confirmará si la variable está llegando bien o es undefined
console.log('[Supabase Init] URL Detectada:', supabaseUrl ? supabaseUrl : 'NO DEFINIDA');

// 3. Validación Estricta
if (!supabaseUrl || !supabaseKey) {
  throw new Error("❌ Error Crítico: Faltan las variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el archivo .env");
}

// 4. Validación de Protocolo (Causa común de Failed to fetch)
if (!supabaseUrl.startsWith('https://')) {
    console.warn("⚠️ ADVERTENCIA: La URL de Supabase no empieza con 'https://'. Esto puede causar errores de conexión.");
}

// 5. Inicialización del Cliente
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true, // Mantiene la sesión activa al recargar
        autoRefreshToken: true,
    }
});