/**
 * Servidor de Impresión para Fluxo POS v6
 * Formato completo con dirección, teléfono y productos
 */

const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3001;

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

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
                res.end(JSON.stringify({ success: false }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

/**
 * Genera el texto del ticket con formato ASCII - Ancho ajustado para 58mm
 */
function generateTicket(order) {
    const W = 28; // Aumentamos un poco el ancho para mejor legibilidad
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

        // Formato "1 x NOMBRE"
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
    lines.push('\r\n\r\n\r\n'); // Espacio para el corte

    return lines.join('\r\n');
}

/**
 * Imprime el ticket usando PowerShell (Sin depender de Notepad)
 * Esto garantiza márgenes cero y fuente fija en cualquier PC.
 */
function printTicket(order, callback) {
    try {
        const content = generateTicket(order);
        const tempFile = path.join(__dirname, 'ticket.txt');

        fs.writeFileSync(tempFile, content, 'utf8');

        // Comando PowerShell "mágico" para imprimir texto con fuente fija y márgenes cero
        const psCommand = `powershell -NoProfile -Command "$content = Get-Content -Path '${tempFile}' -Raw; $p = New-Object System.Drawing.Printing.PrintDocument; $p.DocumentName = 'Ticket Fluxo #${order.ticket_number}'; $p.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0); $p.add_PrintPage({ $_.Graphics.DrawString($content, (New-Object System.Drawing.Font('Consolas', 9)), [System.Drawing.Brushes]::Black, 0, 0) }); $p.Print()"`;

        exec(psCommand, (error) => {
            // Limpieza
            setTimeout(() => { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); }, 2000);

            if (error) {
                console.error('Error PowerShell:', error);
                // Si falla el método pro, intentamos el básico de notepad como último recurso
                exec(`notepad /p "${tempFile}"`, () => { });
            }

            console.log('Ticket #' + order.ticket_number + ' Enviado');
            callback(null);
        });
    } catch (err) {
        console.error('Error general de impresión:', err);
        callback(err);
    }
}

server.listen(PORT, () => {
    console.log('================================');
    console.log('  FLUXO PRINT v6 - Completo');
    console.log('  Puerto: ' + PORT);
    console.log('  Listo!');
    console.log('================================');
});
