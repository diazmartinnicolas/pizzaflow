import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { useApp } from '../context/AppContext';
import {
    History as HistoryIcon, Search, Calendar, Download, AlertTriangle,
    Filter, FileText, User, Tag, Lock, ChevronLeft, ChevronRight,
    MapPin, ShoppingBag, UtensilsCrossed, Banknote, CreditCard, Smartphone,
    DollarSign, X
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

// ============================================================
// TIPOS
// ============================================================

interface SaleRecord {
    id: string;
    ticket_number: number;
    created_at: string;
    total: number;
    status: string;
    order_type: string;
    payment_type: string;
    client?: { name: string; phone?: string; address?: string } | null;
    table_id?: string;
    user_id?: string;
    order_items?: any[];
}

// ============================================================
// HELPERS
// ============================================================

const ORDER_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    local: { label: 'Mesa', icon: UtensilsCrossed, color: 'bg-blue-100 text-blue-700' },
    takeaway: { label: 'Take Away', icon: ShoppingBag, color: 'bg-orange-100 text-orange-700' },
    delivery: { label: 'Delivery', icon: MapPin, color: 'bg-purple-100 text-purple-700' },
};

const PAYMENT_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    efectivo: { label: 'Efectivo', icon: Banknote, color: 'bg-green-100 text-green-700' },
    tarjeta: { label: 'Tarjeta', icon: CreditCard, color: 'bg-blue-100 text-blue-700' },
    transferencia: { label: 'Transfer.', icon: Smartphone, color: 'bg-purple-100 text-purple-700' },
    mercadopago: { label: 'MP', icon: DollarSign, color: 'bg-sky-100 text-sky-700' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
    completed: { label: 'Completado', color: 'bg-green-100 text-green-700' },
    completado: { label: 'Completado', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
    cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
    en_preparacion: { label: 'Preparando', color: 'bg-blue-100 text-blue-700' },
    listo: { label: 'Listo', color: 'bg-green-100 text-green-700' },
};

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(price);
};

const ITEMS_PER_PAGE = 50;

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function History() {
    const { userProfile } = useApp();
    const [sales, setSales] = useState<SaleRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDemo, setIsDemo] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Filtros
    const [filterOrderType, setFilterOrderType] = useState<string>('all');
    const [filterPaymentType, setFilterPaymentType] = useState<string>('all');
    const [filterDateFrom, setFilterDateFrom] = useState<string>('');
    const [filterDateTo, setFilterDateTo] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);

    // Estado para alerta de datos antiguos
    const [oldDataCount, setOldDataCount] = useState(0);
    const [showArchiveAlert, setShowArchiveAlert] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        fetchSales();
        checkOldData();
    }, [currentPage, filterOrderType, filterPaymentType, filterDateFrom, filterDateTo]);

    // ----------------------------------------------------------
    // CARGAR VENTAS
    // ----------------------------------------------------------

    const fetchSales = async () => {
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        const email = user?.email || '';

        if (email.toLowerCase().includes('demo')) {
            setIsDemo(true);
            generateFakeSales();
            return;
        }

        setIsDemo(false);

        try {
            const companyId = userProfile?.company_id || (userProfile as any)?.companies?.id;
            if (!companyId) {
                setLoading(false);
                return;
            }

            // Calcular fecha límite: 1 año atrás
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            let query = supabase
                .from('orders')
                .select(`
          id, ticket_number, created_at, total, status, order_type, payment_type,
          table_id, user_id,
          client:clients(name, phone, address),
          order_items(quantity, item_name, price_at_moment, notes)
        `, { count: 'exact' })
                .eq('company_id', companyId)
                .gte('created_at', oneYearAgo.toISOString())
                .order('created_at', { ascending: false });

            // Aplicar filtros
            if (filterOrderType !== 'all') {
                query = query.eq('order_type', filterOrderType);
            }
            if (filterPaymentType !== 'all') {
                query = query.eq('payment_type', filterPaymentType);
            }
            if (filterDateFrom) {
                query = query.gte('created_at', `${filterDateFrom}T00:00:00`);
            }
            if (filterDateTo) {
                query = query.lte('created_at', `${filterDateTo}T23:59:59`);
            }

            // Paginación
            const from = (currentPage - 1) * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;
            query = query.range(from, to);

            const { data, error, count } = await query;

            if (error) throw error;

            // Normalizar client (Supabase puede devolver array en joins)
            const normalized = (data || []).map((sale: any) => ({
                ...sale,
                client: Array.isArray(sale.client) ? sale.client[0] || null : sale.client
            }));

            setSales(normalized);
            setTotalCount(count || 0);
        } catch (error) {
            console.error("Error cargando historial de ventas:", error);
            toast.error("Error al cargar historial");
        } finally {
            setLoading(false);
        }
    };

    // ----------------------------------------------------------
    // VERIFICAR DATOS ANTIGUOS (> 11 MESES, PRONTO A EXPIRAR)
    // ----------------------------------------------------------

    const checkOldData = async () => {
        try {
            const companyId = userProfile?.company_id || (userProfile as any)?.companies?.id;
            if (!companyId) return;

            // Datos entre 11 y 12 meses (a punto de expirar)
            const elevenMonthsAgo = new Date();
            elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);
            const twelveMonthsAgo = new Date();
            twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

            const { count, error } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', companyId)
                .lte('created_at', elevenMonthsAgo.toISOString())
                .gte('created_at', twelveMonthsAgo.toISOString());

            if (!error && count && count > 0) {
                setOldDataCount(count);
                setShowArchiveAlert(true);
            }
        } catch (err) {
            // Silently fail
        }
    };

    // ----------------------------------------------------------
    // EXPORTAR A EXCEL (CSV)
    // ----------------------------------------------------------

    const exportToExcel = async () => {
        setIsExporting(true);
        try {
            const companyId = userProfile?.company_id || (userProfile as any)?.companies?.id;
            if (!companyId) return;

            // Obtener TODOS los datos del año
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            const { data, error } = await supabase
                .from('orders')
                .select(`
          id, ticket_number, created_at, total, status, order_type, payment_type,
          table_id, user_id,
          client:clients(name, phone, address),
          order_items(quantity, item_name, price_at_moment, notes)
        `)
                .eq('company_id', companyId)
                .gte('created_at', oneYearAgo.toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!data || data.length === 0) {
                toast.error("No hay datos para exportar");
                return;
            }

            // Construir datos para Excel
            const excelRows = data.map((sale: any) => {
                const date = new Date(sale.created_at);
                const client = Array.isArray(sale.client) ? sale.client[0] : sale.client;
                const orderTypeLabel = ORDER_TYPE_CONFIG[sale.order_type]?.label || sale.order_type || '-';
                const paymentLabel = PAYMENT_TYPE_CONFIG[sale.payment_type]?.label || sale.payment_type || '-';
                const statusLabel = STATUS_CONFIG[sale.status]?.label || sale.status || '-';

                const itemsList = sale.order_items
                    ?.map((item: any) => `${item.quantity}x ${item.item_name || 'Producto'}`)
                    .join(', ') || '-';

                return {
                    'Ticket': `#${sale.ticket_number}`,
                    'Fecha': date.toLocaleDateString('es-AR'),
                    'Hora': date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
                    'Tipo': orderTypeLabel,
                    'Estado': statusLabel,
                    'Método de Pago': paymentLabel,
                    'Cliente': client?.name || '-',
                    'Teléfono': client?.phone || '-',
                    'Dirección': client?.address || '-',
                    'Productos': itemsList,
                    'Total': sale.total || 0
                };
            });

            // Crear libro de Excel
            const ws = XLSX.utils.json_to_sheet(excelRows);

            // Auto-ajustar ancho de columnas
            const colWidths = Object.keys(excelRows[0]).map(key => ({
                wch: Math.max(
                    key.length,
                    ...excelRows.map((row: any) => String(row[key]).length)
                ) + 2
            }));
            ws['!cols'] = colWidths;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Historial de Ventas');

            const today = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Fluxo_Historial_Ventas_${today}.xlsx`);

            toast.success(`Exportadas ${data.length} ventas correctamente`);
        } catch (error) {
            console.error("Error exportando:", error);
            toast.error("Error al exportar datos");
        } finally {
            setIsExporting(false);
        }
    };

    // ----------------------------------------------------------
    // DATOS DEMO
    // ----------------------------------------------------------

    const generateFakeSales = () => {
        const types = ['local', 'takeaway', 'delivery'];
        const payments = ['efectivo', 'tarjeta', 'transferencia'];
        const statuses = ['completed', 'pendiente', 'cancelled'];
        const clients = [
            { name: 'Mario Bros' }, { name: 'Luigi Verdi' }, { name: 'Ana López' },
            null, null, { name: 'Carlos Ruiz' }
        ];

        const fakeData: SaleRecord[] = Array.from({ length: 30 }).map((_, i) => ({
            id: `fake-${i}`,
            ticket_number: 30 - i,
            created_at: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
            total: Math.floor(Math.random() * 40000) + 5000,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            order_type: types[Math.floor(Math.random() * types.length)],
            payment_type: payments[Math.floor(Math.random() * payments.length)],
            client: clients[Math.floor(Math.random() * clients.length)],
            order_items: [
                { quantity: 1, item_name: 'Pizza Muzzarella Gde.', price_at_moment: 17000 },
                { quantity: 2, item_name: 'Cerveza Heineken 1L', price_at_moment: 10000 }
            ]
        }));

        fakeData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setSales(fakeData);
        setTotalCount(30);
        setLoading(false);
    };

    // ----------------------------------------------------------
    // FILTRADO LOCAL (búsqueda por texto)
    // ----------------------------------------------------------

    const filteredSales = useMemo(() => {
        if (!searchTerm) return sales;
        const term = searchTerm.toLowerCase();
        return sales.filter(sale =>
            sale.ticket_number?.toString().includes(term) ||
            sale.client?.name?.toLowerCase().includes(term) ||
            sale.order_type?.toLowerCase().includes(term) ||
            sale.payment_type?.toLowerCase().includes(term) ||
            sale.order_items?.some((item: any) => item.item_name?.toLowerCase().includes(term))
        );
    }, [sales, searchTerm]);



    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

    // ----------------------------------------------------------
    // RENDER
    // ----------------------------------------------------------

    if (loading) {
        return (
            <div className="p-8 text-center text-gray-500 animate-pulse">
                Cargando historial de ventas...
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-4 md:p-6 max-w-full">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <HistoryIcon className="text-gray-600" /> Historial de Ventas
                    </h2>
                    <p className="text-sm text-gray-400 mt-0.5">
                        Últimos 12 meses · {totalCount} registros
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-sm transition-colors border ${showFilters ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}
                    >
                        <Filter size={16} /> Filtros
                    </button>
                    <button
                        onClick={exportToExcel}
                        disabled={isExporting}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-sm bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                        <Download size={16} /> {isExporting ? 'Exportando...' : 'Exportar Excel'}
                    </button>
                </div>
            </div>

            {/* ALERTA DE DATOS PRÓXIMOS A EXPIRAR */}
            {showArchiveAlert && oldDataCount > 0 && (
                <div className="mb-4 bg-amber-50 border-2 border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle size={24} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="font-bold text-amber-800">
                            ⚠️ {oldDataCount} registros están próximos a cumplir 1 año
                        </p>
                        <p className="text-sm text-amber-700 mt-1">
                            Los datos con más de 12 meses se eliminarán automáticamente. Te recomendamos descargar el historial completo antes de que se borren.
                        </p>
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={exportToExcel}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-sm bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                            >
                                <Download size={16} /> Descargar historial completo
                            </button>
                            <button
                                onClick={() => setShowArchiveAlert(false)}
                                className="px-3 py-2 rounded-lg text-sm text-amber-600 hover:bg-amber-100 transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isDemo && (
                <div className="mb-4 bg-orange-50 text-orange-800 p-3 rounded-lg flex items-center gap-2 text-sm border border-orange-200">
                    <Lock size={16} />
                    <span><strong>Modo Simulación:</strong> Datos generados para demostración.</span>
                </div>
            )}

            {/* FILTROS */}
            {showFilters && (
                <div className="mb-4 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {/* Tipo de pedido */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Tipo</label>
                            <select
                                value={filterOrderType}
                                onChange={(e) => { setFilterOrderType(e.target.value); setCurrentPage(1); }}
                                className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                            >
                                <option value="all">Todos</option>
                                <option value="local">Mesa</option>
                                <option value="takeaway">Take Away</option>
                                <option value="delivery">Delivery</option>
                            </select>
                        </div>
                        {/* Método de pago */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Pago</label>
                            <select
                                value={filterPaymentType}
                                onChange={(e) => { setFilterPaymentType(e.target.value); setCurrentPage(1); }}
                                className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                            >
                                <option value="all">Todos</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="tarjeta">Tarjeta</option>
                                <option value="transferencia">Transferencia</option>
                            </select>
                        </div>
                        {/* Fecha desde */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Desde</label>
                            <input
                                type="date"
                                value={filterDateFrom}
                                onChange={(e) => { setFilterDateFrom(e.target.value); setCurrentPage(1); }}
                                className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                            />
                        </div>
                        {/* Fecha hasta */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Hasta</label>
                            <input
                                type="date"
                                value={filterDateTo}
                                onChange={(e) => { setFilterDateTo(e.target.value); setCurrentPage(1); }}
                                className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                            />
                        </div>
                    </div>
                    {(filterOrderType !== 'all' || filterPaymentType !== 'all' || filterDateFrom || filterDateTo) && (
                        <button
                            onClick={() => {
                                setFilterOrderType('all');
                                setFilterPaymentType('all');
                                setFilterDateFrom('');
                                setFilterDateTo('');
                                setCurrentPage(1);
                            }}
                            className="mt-3 text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-bold"
                        >
                            <X size={14} /> Limpiar filtros
                        </button>
                    )}
                </div>
            )}


            {/* BUSCADOR */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar por ticket, cliente, producto..."
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* TABLA DE VENTAS */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">#</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">
                                    <span className="flex items-center gap-1"><Calendar size={12} /> Fecha</span>
                                </th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">Tipo</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">
                                    <span className="flex items-center gap-1"><User size={12} /> Cliente</span>
                                </th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">Productos</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">Pago</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">Estado</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredSales.map((sale) => {
                                const orderType = ORDER_TYPE_CONFIG[sale.order_type] || { label: sale.order_type || '-', icon: FileText, color: 'bg-gray-100 text-gray-600' };
                                const paymentType = PAYMENT_TYPE_CONFIG[sale.payment_type] || { label: sale.payment_type || '-', icon: DollarSign, color: 'bg-gray-100 text-gray-600' };
                                const statusCfg = STATUS_CONFIG[sale.status] || { label: sale.status || '-', color: 'bg-gray-100 text-gray-600' };
                                const OrderIcon = orderType.icon;
                                const PayIcon = paymentType.icon;
                                const date = new Date(sale.created_at);

                                return (
                                    <tr key={sale.id} className="hover:bg-gray-50 transition-colors text-sm">
                                        <td className="p-3 font-black text-gray-800">
                                            #{sale.ticket_number}
                                        </td>
                                        <td className="p-3 whitespace-nowrap text-gray-600">
                                            <div>{date.toLocaleDateString('es-AR')}</div>
                                            <div className="text-xs text-gray-400">{date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td className="p-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${orderType.color}`}>
                                                <OrderIcon size={12} /> {orderType.label}
                                            </span>
                                        </td>
                                        <td className="p-3 text-gray-700 font-medium">
                                            {sale.client?.name || <span className="text-gray-400 italic">Sin cliente</span>}
                                        </td>
                                        <td className="p-3 text-gray-600 max-w-[200px]">
                                            <div className="truncate text-xs" title={sale.order_items?.map((i: any) => `${i.quantity}x ${i.item_name}`).join(', ')}>
                                                {sale.order_items?.slice(0, 2).map((item: any, idx: number) => (
                                                    <span key={idx}>
                                                        {idx > 0 && ', '}
                                                        {item.quantity}x {item.item_name || 'Producto'}
                                                    </span>
                                                ))}
                                                {(sale.order_items?.length || 0) > 2 && (
                                                    <span className="text-gray-400"> +{(sale.order_items?.length || 0) - 2} más</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${paymentType.color}`}>
                                                <PayIcon size={12} /> {paymentType.label}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${statusCfg.color}`}>
                                                {statusCfg.label}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right font-black text-gray-800">
                                            {formatPrice(sale.total)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {filteredSales.length === 0 && (
                        <div className="p-12 text-center text-gray-400">
                            No se encontraron ventas con los filtros actuales.
                        </div>
                    )}
                </div>
            </div>

            {/* PAGINACIÓN */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                    <span>
                        Página {currentPage} de {totalPages} ({totalCount} resultados)
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={16} /> Anterior
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Siguiente <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}