/**
 * Servidor de Impresión para Fluxo POS v7
 * - Escucha en TODAS las interfaces (accesible desde la red)
 * - Auto-detecta su IP local
 * - Se registra en Supabase para auto-descubrimiento
 * - Endpoint /status para health-check
 * - Compatible con Gadnic IT1050 (58mm)
 */

const http = require('http');
const https = require('https');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3001;

// ============================================================
// CONFIGURACIÓN DE SUPABASE (lee del .env del proyecto padre)
// ============================================================

function loadEnv() {
    try {
        const envPath = path.join(__dirname, '..', '.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const vars = {};
        envContent.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                vars[key.trim()] = valueParts.join('=').trim();
            }
        });
        return vars;
    } catch (err) {
        console.warn('⚠️  No se pudo leer .env, registro en Supabase deshabilitado');
        return {};
    }
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;

// ============================================================
// AUTO-DETECTAR IP LOCAL
// ============================================================

function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            // Solo IPv4, no loopback
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push({ name, address: iface.address });
            }
        }
    }
    return ips;
}

// ============================================================
// REGISTRAR IP EN SUPABASE
// ============================================================

async function registerInSupabase(ip) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.log('ℹ️  Sin credenciales Supabase, omitiendo registro');
        return;
    }

    try {
        const url = `${SUPABASE_URL}/rest/v1/app_settings?key=eq.print_server_ip`;

        // Primero intentar PATCH (update)
        const patchData = JSON.stringify({ value: ip, updated_at: new Date().toISOString() });

        const patchResult = await fetchSupabase(url, 'PATCH', patchData, {
            'Prefer': 'return=minimal'
        });

        // Si no encontró fila para actualizar, hacer INSERT
        if (patchResult.status === 404 || patchResult.noRows) {
            const insertUrl = `${SUPABASE_URL}/rest/v1/app_settings`;
            const insertData = JSON.stringify({
                key: 'print_server_ip',
                value: ip,
                updated_at: new Date().toISOString()
            });
            await fetchSupabase(insertUrl, 'POST', insertData, {
                'Prefer': 'return=minimal'
            });
        }

        console.log('✅ IP registrada en Supabase: ' + ip);
    } catch (err) {
        console.warn('⚠️  Error registrando en Supabase:', err.message);
        // No es un error crítico, el servidor sigue funcionando
    }
}

function fetchSupabase(url, method, body, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);

        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                ...extraHeaders
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                // PATCH returns 200 with empty body when no rows matched
                const noRows = method === 'PATCH' && (!data || data === '[]' || data === '');
                resolve({ status: res.statusCode, data, noRows });
            });
        });

        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

// ============================================================
// TICKET GENERATOR (58mm - Gadnic IT1050)
// ============================================================

function generateTicket(order) {
    const W = 28;
    const lines = [];

    const center = (t) => {
        const s = String(t).substring(0, W);
        const p = Math.floor((W - s.length) / 2);
        return ' '.repeat(Math.max(0, p)) + s;
    };

    const sep = '='.repeat(W);
    const dash = '-'.repeat(W);

    const wrap = (text) => {
        const result = [];
        let remaining = String(text);
        while (remaining.length > 0) {
            result.push(remaining.substring(0, W));
            remaining = remaining.substring(W);
        }
        return result;
    };

    // Header
    lines.push(center(order.companyName || 'FLUXO'));
    const fecha = new Date().toLocaleDateString('es-AR');
    const hora = new Date().toLocaleTimeString('es-AR').substring(0, 5);
    lines.push(center(fecha + ' - ' + hora));
    lines.push(sep);

    // Ticket
    lines.push('TICKET: #' + order.ticket_number);
    lines.push(dash);

    // Tipo y pago
    let tipo = (order.order_type || 'LOCAL').toUpperCase();
    if (tipo === 'DELIVERY') tipo = '[DELIVERY]';
    else if (tipo === 'TAKEAWAY') tipo = '[P/LLEVAR]';
    else tipo = '[MESA]';

    const pago = '[' + (order.payment_type || 'EFECTIVO').toUpperCase() + ']';

    lines.push(tipo + ' ' + pago);
    lines.push(sep);

    // Si es mesa
    if (order.table) {
        lines.push('MESA: ' + (order.table.name || order.table.id).toUpperCase());
        lines.push(dash);
    }

    // Cliente / Dirección
    lines.push('CLIENTE / DIRECCION:');
    lines.push((order.client?.name || 'Mostrador').toUpperCase());

    const direccion = order.delivery_address || order.client?.address;
    if (direccion) {
        lines.push(...wrap(direccion.toUpperCase()));
    }

    const telefono = order.delivery_phone || order.client?.phone;
    if (telefono) {
        lines.push('TELEFONO:');
        lines.push(telefono);
    }
    lines.push(sep);

    // Productos
    lines.push('');
    (order.order_items || []).forEach(item => {
        const qty = item.quantity || 1;
        const name = (item.item_name || item.product?.name || 'Item').toUpperCase();

        lines.push(`${qty} x ${name}`);

        if (item.notes) {
            lines.push(...wrap('  (' + item.notes + ')').map(l => '  ' + l.trim()));
        }
    });

    lines.push('');
    lines.push(sep);

    // Total
    if (order.total) {
        lines.push('');
        lines.push('TOTAL: $' + Number(order.total).toLocaleString('es-AR'));
        lines.push('');
        lines.push(sep);
    }

    // Observaciones
    lines.push('OBSERVACIONES:');
    lines.push('+' + '-'.repeat(W - 2) + '+');
    lines.push('|' + ' '.repeat(W - 2) + '|');
    lines.push('|' + ' '.repeat(W - 2) + '|');
    lines.push('+' + '-'.repeat(W - 2) + '+');
    lines.push(dash);

    // Footer
    lines.push('');
    lines.push(center('*** FIN DE ORDEN ***'));
    lines.push('\r\n\r\n\r\n');

    return lines.join('\r\n');
}

// ============================================================
// IMPRESIÓN (PowerShell directo a impresora predeterminada)
// ============================================================

function printTicket(order, callback) {
    try {
        const content = generateTicket(order);
        const tempFile = path.join(__dirname, 'ticket.txt');

        fs.writeFileSync(tempFile, content, 'utf8');

        const psCommand = `powershell -NoProfile -Command "$content = Get-Content -Path '${tempFile}' -Raw; $p = New-Object System.Drawing.Printing.PrintDocument; $p.DocumentName = 'Ticket Fluxo #${order.ticket_number}'; $p.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0); $p.add_PrintPage({ $_.Graphics.DrawString($content, (New-Object System.Drawing.Font('Consolas', 9)), [System.Drawing.Brushes]::Black, 0, 0) }); $p.Print()"`;

        exec(psCommand, (error) => {
            setTimeout(() => { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); }, 2000);

            if (error) {
                console.error('Error PowerShell:', error.message);
                exec(`notepad /p "${tempFile}"`, () => { });
            }

            console.log('🖨️  Ticket #' + order.ticket_number + ' enviado');
            callback(null);
        });
    } catch (err) {
        console.error('Error general de impresión:', err);
        callback(err);
    }
}

// ============================================================
// SERVIDOR HTTP
// ============================================================

const server = http.createServer((req, res) => {
    // CORS para cualquier origen (red local)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Health-check / auto-descubrimiento
    if (req.method === 'GET' && req.url === '/status') {
        const ips = getLocalIPs();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            version: 'v7',
            ips: ips.map(i => i.address),
            timestamp: new Date().toISOString()
        }));
        return;
    }

    // Impresión
    if (req.method === 'POST' && req.url === '/print') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                printTicket(data, (err) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: err.message }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    }
                });
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'JSON inválido' }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

// ============================================================
// INICIO
// ============================================================

// Escuchar en TODAS las interfaces (0.0.0.0)
server.listen(PORT, '0.0.0.0', async () => {
    const ips = getLocalIPs();
    const primaryIp = ips.length > 0 ? ips[0].address : 'localhost';

    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║       FLUXO PRINT SERVER v7              ║');
    console.log('║       Gadnic IT1050 (58mm)               ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log('║  Estado: ✅ LISTO                        ║');
    console.log('║                                          ║');
    console.log('║  Acceso local:                           ║');
    console.log(`║    http://localhost:${PORT}                 ║`);
    console.log('║                                          ║');

    if (ips.length > 0) {
        console.log('║  Acceso desde la red:                    ║');
        ips.forEach(ip => {
            const line = `    http://${ip.address}:${PORT}`;
            console.log(`║  ${line.padEnd(39)}║`);
        });
        console.log('║                                          ║');
    }

    console.log('╚══════════════════════════════════════════╝');
    console.log('');

    // Registrar IP en Supabase para auto-descubrimiento
    if (primaryIp !== 'localhost') {
        await registerInSupabase(primaryIp);
    }
});
