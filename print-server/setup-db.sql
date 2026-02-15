-- ============================================================
-- Tabla para configuración de la app (auto-descubrimiento de impresora, etc.)
-- Ejecutar en Supabase SQL Editor: https://supabase.com/dashboard
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar acceso desde la API (anon key)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden leer settings"
    ON app_settings FOR SELECT
    USING (true);

CREATE POLICY "Todos pueden insertar settings"
    ON app_settings FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Todos pueden actualizar settings"
    ON app_settings FOR UPDATE
    USING (true);
