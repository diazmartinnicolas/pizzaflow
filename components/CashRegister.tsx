import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import {
    Calculator, Printer, CheckCircle, AlertTriangle,
    TrendingUp, TrendingDown, Loader2, Banknote, CreditCard, Smartphone
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';

// ============================================================
// TIPOS
// ============================================================

interface SalesBreakdown {
    total: number;
    cash: number;
    card: number;
    transfer: number;
    orderCount: number;
}

// ============================================================
// TICKET DE IMPRESIÓN
// ============================================================

const CashClosingTicket = React.forwardRef<HTMLDivElement, {
    salesBreakdown: SalesBreakdown;
    countedCash: number;
    difference: number;
    notes: string;
    companyName: string;
    userName: string;
    closingDate: Date;
}>(({ salesBreakdown, countedCash, difference, notes, companyName, userName, closingDate }, ref) => {
    const fmt = (val: number) => new Intl.NumberFormat('es-AR', {
        style: 'currency', currency: 'ARS', maximumFractionDigits: 0
    }).format(val);

    return (
        <div ref={ref} className="hidden print:block p-4 bg-white text-black font-mono text-sm w-[80mm] mx-auto">
            <div className="text-center mb-4 border-b-2 border-black pb-2">
                <h2 className="font-black text-xl uppercase">{companyName}</h2>
                <p className="text-xs mt-1">CIERRE DE CAJA</p>
                <p className="text-[10px] mt-1">
                    {closingDate.toLocaleDateString('es-AR')} - {closingDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-[10px]">Cajero: {userName}</p>
            </div>

            <div className="mb-4 border-b border-dashed border-black pb-2">
                <p className="font-bold text-center mb-2">RESUMEN DE VENTAS</p>
                <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                        <span>Total Órdenes:</span>
                        <span className="font-bold">{salesBreakdown.orderCount}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-300 pt-1">
                        <span>💵 Efectivo:</span>
                        <span>{fmt(salesBreakdown.cash)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>💳 Tarjeta:</span>
                        <span>{fmt(salesBreakdown.card)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>🏦 Transferencia:</span>
                        <span>{fmt(salesBreakdown.transfer)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base border-t-2 border-black pt-1 mt-2">
                        <span>TOTAL VENTAS:</span>
                        <span>{fmt(salesBreakdown.total)}</span>
                    </div>
                </div>
            </div>

            {salesBreakdown.cash > 0 && (
                <div className="mb-4 border-b border-dashed border-black pb-2">
                    <p className="font-bold text-center mb-2">CUADRE DE EFECTIVO</p>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                            <span>Esperado:</span>
                            <span>{fmt(salesBreakdown.cash)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Contado:</span>
                            <span>{fmt(countedCash)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-300">
                            <span>Diferencia:</span>
                            <span>{difference >= 0 ? '+' : ''}{fmt(difference)}</span>
                        </div>
                    </div>
                </div>
            )}

            {notes && (
                <div className="mb-4 text-xs">
                    <p className="font-bold">Observaciones:</p>
                    <p className="mt-1">{notes}</p>
                </div>
            )}

            <div className="text-center text-[10px] border-t-2 border-black pt-2 mt-4">
                <p>*** FIN DE CIERRE ***</p>
                <p className="mt-1">Generado por Fluxo</p>
            </div>
        </div>
    );
});

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function CashRegister() {
    const { userProfile, session } = useApp();
    const [loading, setLoading] = useState(true);
    const [salesBreakdown, setSalesBreakdown] = useState<SalesBreakdown>({
        total: 0, cash: 0, card: 0, transfer: 0, orderCount: 0
    });
    const [countedCash, setCountedCash] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [closed, setClosed] = useState(false);

    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({ contentRef: printRef });

    const companyId = userProfile?.company_id || (userProfile as any)?.companies?.id;
    const companyName = (userProfile as any)?.companies?.name || 'Fluxo';

    const countedCashNum = parseFloat(countedCash) || 0;
    const difference = countedCashNum - salesBreakdown.cash;

    const formatPrice = (val: number) => new Intl.NumberFormat('es-AR', {
        style: 'currency', currency: 'ARS', maximumFractionDigits: 0
    }).format(val);

    // ----------------------------------------------------------
    // CARGAR VENTAS DEL DÍA
    // ----------------------------------------------------------

    useEffect(() => {
        const fetchTodaySales = async () => {
            if (!companyId) { setLoading(false); return; }

            setLoading(true);
            try {
                const today = new Date();
                const startOfDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T00:00:00`;

                const { data: orders, error } = await supabase
                    .from('orders')
                    .select('total, payment_type')
                    .eq('company_id', companyId)
                    .gte('created_at', startOfDay)
                    .neq('status', 'cancelado');

                if (error) throw error;

                let cash = 0, card = 0, transfer = 0, total = 0;

                orders?.forEach(order => {
                    const amount = order.total || 0;
                    total += amount;

                    switch (order.payment_type?.toLowerCase()) {
                        case 'cash':
                        case 'efectivo':
                            cash += amount;
                            break;
                        case 'card':
                        case 'tarjeta':
                            card += amount;
                            break;
                        case 'transfer':
                        case 'transferencia':
                            transfer += amount;
                            break;
                        default:
                            cash += amount;
                    }
                });

                setSalesBreakdown({ total, cash, card, transfer, orderCount: orders?.length || 0 });
            } catch (err: any) {
                console.error('Error fetching sales:', err);
                toast.error('Error al cargar ventas del día');
            } finally {
                setLoading(false);
            }
        };

        fetchTodaySales();
    }, [companyId]);

    // ----------------------------------------------------------
    // GUARDAR CIERRE
    // ----------------------------------------------------------

    const handleSaveClosing = async () => {
        setSaving(true);
        try {
            const closingData = {
                company_id: companyId,
                user_id: session?.user?.id,
                closed_at: new Date().toISOString(),
                total_sales: salesBreakdown.total,
                cash_sales: salesBreakdown.cash,
                card_sales: salesBreakdown.card,
                transfer_sales: salesBreakdown.transfer,
                order_count: salesBreakdown.orderCount,
                expected_cash: salesBreakdown.cash,
                counted_cash: countedCashNum,
                difference: difference,
                notes: notes
            };

            const { error } = await supabase
                .from('cash_closings')
                .insert([closingData]);

            if (error) throw error;

            toast.success('Cierre de caja guardado correctamente');
            setClosed(true);

            setTimeout(() => handlePrint(), 500);
        } catch (err: any) {
            console.error('Error saving closing:', err);
            toast.error('Error al guardar cierre: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // ----------------------------------------------------------
    // RENDER
    // ----------------------------------------------------------

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-orange-500" size={48} />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-4 md:p-6 bg-gray-50">
            {/* Ticket oculto para impresión */}
            <div className="hidden">
                <CashClosingTicket
                    ref={printRef}
                    salesBreakdown={salesBreakdown}
                    countedCash={countedCashNum}
                    difference={difference}
                    notes={notes}
                    companyName={companyName}
                    userName={userProfile?.full_name || session?.user?.email || 'Usuario'}
                    closingDate={new Date()}
                />
            </div>

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <Calculator size={28} className="text-orange-500" />
                    Cierre de Caja
                </h2>
                <div className="text-sm text-gray-500">
                    {new Date().toLocaleDateString('es-AR', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    })}
                </div>
            </div>

            {/* Ya cerrado */}
            {closed && (
                <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle size={24} className="text-green-600" />
                    <div>
                        <p className="font-bold text-green-800">Cierre guardado exitosamente</p>
                        <p className="text-sm text-green-600">El ticket se envió a imprimir.</p>
                    </div>
                    <button
                        onClick={() => handlePrint()}
                        className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
                    >
                        <Printer size={16} /> Reimprimir
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* COLUMNA IZQUIERDA: Resumen del día */}
                <div className="space-y-4">
                    {/* Total del día */}
                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-5 shadow-lg">
                        <p className="text-orange-100 text-sm font-medium">Ventas del Día</p>
                        <p className="text-3xl font-black mt-1">{formatPrice(salesBreakdown.total)}</p>
                        <p className="text-orange-200 text-sm mt-1">{salesBreakdown.orderCount} órdenes</p>
                    </div>

                    {/* Desglose por método */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800">Desglose por método de pago</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {[
                                { label: 'Efectivo', amount: salesBreakdown.cash, icon: Banknote, iconColor: 'text-green-500', bgColor: 'bg-green-50' },
                                { label: 'Tarjeta', amount: salesBreakdown.card, icon: CreditCard, iconColor: 'text-blue-500', bgColor: 'bg-blue-50' },
                                { label: 'Transferencia', amount: salesBreakdown.transfer, icon: Smartphone, iconColor: 'text-purple-500', bgColor: 'bg-purple-50' },
                            ].map((item) => {
                                const Icon = item.icon;
                                const pct = salesBreakdown.total > 0 ? ((item.amount / salesBreakdown.total) * 100).toFixed(0) : '0';
                                return (
                                    <div key={item.label} className="flex items-center gap-3 p-4">
                                        <div className={`w-10 h-10 rounded-lg ${item.bgColor} flex items-center justify-center`}>
                                            <Icon size={20} className={item.iconColor} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-800">{item.label}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${item.iconColor.replace('text-', 'bg-')}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-400 w-8">{pct}%</span>
                                            </div>
                                        </div>
                                        <p className="font-bold text-gray-800 text-lg">{formatPrice(item.amount)}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* COLUMNA DERECHA: Cuadre de efectivo + Confirmar */}
                <div className="space-y-4">
                    {/* Cuadre de efectivo */}
                    {salesBreakdown.cash > 0 ? (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                <Banknote size={20} className="text-green-500" />
                                Cuadre de Efectivo
                            </h3>
                            <p className="text-sm text-gray-500 mb-4">
                                El sistema registró <strong>{formatPrice(salesBreakdown.cash)}</strong> en efectivo.
                                ¿Cuánto hay en caja?
                            </p>

                            <div className="relative mb-4">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-gray-400 font-bold">$</span>
                                <input
                                    type="number"
                                    value={countedCash}
                                    onChange={(e) => setCountedCash(e.target.value)}
                                    placeholder="0"
                                    className="w-full pl-10 pr-4 py-4 border-2 border-gray-200 rounded-xl text-2xl font-bold text-center focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none transition-all"
                                    disabled={closed}
                                />
                            </div>

                            {/* Diferencia */}
                            {countedCash !== '' && (
                                <div className={`rounded-xl p-4 flex items-center gap-3 ${difference === 0
                                        ? 'bg-green-50 border border-green-200'
                                        : difference > 0
                                            ? 'bg-blue-50 border border-blue-200'
                                            : 'bg-red-50 border border-red-200'
                                    }`}>
                                    {difference === 0 && <CheckCircle size={24} className="text-green-500" />}
                                    {difference > 0 && <TrendingUp size={24} className="text-blue-500" />}
                                    {difference < 0 && <TrendingDown size={24} className="text-red-500" />}
                                    <div>
                                        <p className={`font-bold ${difference === 0 ? 'text-green-700' : difference > 0 ? 'text-blue-700' : 'text-red-700'
                                            }`}>
                                            {difference === 0
                                                ? 'Caja cuadrada ✓'
                                                : difference > 0
                                                    ? `Sobrante: ${formatPrice(difference)}`
                                                    : `Faltante: ${formatPrice(Math.abs(difference))}`
                                            }
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5 text-center">
                            <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
                            <p className="font-bold text-green-800">No hubo ventas en efectivo hoy</p>
                            <p className="text-sm text-green-600 mt-1">
                                No es necesario cuadrar la caja.
                            </p>
                        </div>
                    )}

                    {/* Observaciones */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <h3 className="font-bold text-gray-800 mb-3">Observaciones</h3>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Notas sobre el cierre (opcional)..."
                            rows={3}
                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-200 focus:border-orange-400 resize-none outline-none text-sm"
                            disabled={closed}
                        />
                    </div>

                    {/* Botón de cierre */}
                    {!closed && (
                        <button
                            onClick={handleSaveClosing}
                            disabled={saving || (salesBreakdown.cash > 0 && countedCash === '')}
                            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-lg shadow-lg"
                        >
                            {saving ? (
                                <><Loader2 size={20} className="animate-spin" /> Guardando...</>
                            ) : (
                                <><Printer size={20} /> Cerrar Caja e Imprimir</>
                            )}
                        </button>
                    )}

                    {/* Advertencia si hay faltante */}
                    {countedCash !== '' && difference < 0 && !closed && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-amber-700">
                                Se registrará el faltante de {formatPrice(Math.abs(difference))} en el cierre. Podés agregar una nota para explicar la diferencia.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
