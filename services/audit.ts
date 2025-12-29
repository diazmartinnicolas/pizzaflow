import { supabase } from './supabase';

/**
 * Registra una acción en el historial.
 * @param action Tipo de acción (ej: 'LOGIN', 'CREAR_CLIENTE', 'VENTA')
 * @param details Descripción humana de lo que pasó
 * @param module Módulo donde ocurrió (ej: 'Clientes', 'Caja')
 */
export const logAction = async (action: string, details: string, module: string) => {
    try {
        // 1. Obtener usuario actual
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user || !user.email) return;

        // 2. FILTRO DEMO: Si es demo, NO guardamos nada en la base de datos real.
        // Simplemente retornamos (o hacemos un console.log para debug)
        if (user.email.toLowerCase().includes('demo')) {
            console.log(`[AUDIT SIMULADO] ${action}: ${details}`);
            return;
        }

        // 3. GUARDAR EN BASE DE DATOS REAL
        const { error } = await supabase.from('audit_logs').insert([{
            user_id: user.id,
            user_email: user.email,
            action: action,
            details: details,
            module: module
        }]);

        if (error) console.error("Error guardando log:", error);

    } catch (e) {
        console.error("Error en servicio de auditoría:", e);
    }
};