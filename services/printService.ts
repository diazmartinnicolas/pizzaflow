/**
 * Servicio centralizado de impresión para Fluxo POS
 * 
 * Flujo de auto-descubrimiento:
 * 1. Intenta con la URL guardada en localStorage (reconexión instantánea)
 * 2. Intenta localhost:3001 (misma PC)
 * 3. Busca la IP del print-server registrada en Supabase (otra PC en la red)
 * 4. Si nada funciona → fallback al diálogo de impresión del navegador
 */

import { supabase } from './supabase';

const PRINT_PORT = 3001;
const STORAGE_KEY = 'fluxo_print_server_url';
const TIMEOUT_MS = 2000;

type PrintStatus = 'connected' | 'disconnected' | 'searching';

let cachedUrl: string | null = null;
let statusListeners: ((status: PrintStatus, url?: string) => void)[] = [];

// ============================================================
// HELPERS
// ============================================================

function notifyListeners(status: PrintStatus, url?: string) {
    statusListeners.forEach(fn => fn(status, url));
}

/**
 * Intenta conectar con un print-server en una URL dada.
 * Retorna true si responde correctamente.
 */
async function tryServer(url: string): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(`${url}/status`, {
            signal: controller.signal,
        });

        clearTimeout(timeout);
        return response.ok;
    } catch {
        return false;
    }
}

// ============================================================
// DESCUBRIMIENTO AUTOMÁTICO
// ============================================================

/**
 * Busca el print-server automáticamente y guarda la URL encontrada.
 */
export async function discoverPrintServer(): Promise<string | null> {
    notifyListeners('searching');

    // 1. Intentar URL guardada en localStorage
    const savedUrl = localStorage.getItem(STORAGE_KEY);
    if (savedUrl) {
        if (await tryServer(savedUrl)) {
            cachedUrl = savedUrl;
            notifyListeners('connected', savedUrl);
            return savedUrl;
        }
    }

    // 2. Intentar localhost (misma PC)
    const localUrl = `http://localhost:${PRINT_PORT}`;
    if (await tryServer(localUrl)) {
        cachedUrl = localUrl;
        localStorage.setItem(STORAGE_KEY, localUrl);
        notifyListeners('connected', localUrl);
        return localUrl;
    }

    // 3. Buscar IP registrada en Supabase por el print-server
    try {
        const { data } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'print_server_ip')
            .maybeSingle();

        if (data?.value) {
            const remoteUrl = `http://${data.value}:${PRINT_PORT}`;
            if (await tryServer(remoteUrl)) {
                cachedUrl = remoteUrl;
                localStorage.setItem(STORAGE_KEY, remoteUrl);
                notifyListeners('connected', remoteUrl);
                return remoteUrl;
            }
        }
    } catch (err) {
        console.warn('[PrintService] Error consultando Supabase:', err);
    }

    // 4. No encontrado
    cachedUrl = null;
    localStorage.removeItem(STORAGE_KEY);
    notifyListeners('disconnected');
    return null;
}

// ============================================================
// IMPRESIÓN
// ============================================================

/**
 * Envía un pedido al print-server para imprimir.
 * Retorna true si se imprimió correctamente, false si debe usar fallback.
 */
export async function printOrder(order: any): Promise<boolean> {
    // Si no hay URL cacheada, intentar descubrir
    if (!cachedUrl) {
        await discoverPrintServer();
    }

    if (!cachedUrl) {
        return false; // No hay servidor, usar fallback del navegador
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${cachedUrl}/print`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
            return true;
        }

        // Si falla, limpiar cache y reintentar descubrimiento en background
        cachedUrl = null;
        discoverPrintServer(); // async, no await
        return false;
    } catch {
        cachedUrl = null;
        discoverPrintServer();
        return false;
    }
}

// ============================================================
// STATUS & LISTENERS
// ============================================================

/**
 * Retorna la URL actual del print-server (o null)
 */
export function getPrintServerUrl(): string | null {
    return cachedUrl;
}

/**
 * Retorna si hay un print-server conectado
 */
export function isConnected(): boolean {
    return cachedUrl !== null;
}

/**
 * Suscribirse a cambios de estado de la impresora
 */
export function onStatusChange(callback: (status: PrintStatus, url?: string) => void) {
    statusListeners.push(callback);
    return () => {
        statusListeners = statusListeners.filter(fn => fn !== callback);
    };
}

/**
 * Forzar re-descubrimiento (por ej. desde settings)
 */
export async function reconnect(): Promise<boolean> {
    cachedUrl = null;
    localStorage.removeItem(STORAGE_KEY);
    const url = await discoverPrintServer();
    return url !== null;
}

/**
 * Configurar manualmente la IP del servidor
 */
export async function setManualIp(ip: string): Promise<boolean> {
    const url = `http://${ip}:${PRINT_PORT}`;
    if (await tryServer(url)) {
        cachedUrl = url;
        localStorage.setItem(STORAGE_KEY, url);
        notifyListeners('connected', url);
        return true;
    }
    return false;
}

// Auto-descubrir al cargar el módulo
discoverPrintServer();
