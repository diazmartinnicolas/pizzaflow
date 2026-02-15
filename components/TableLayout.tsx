import React, { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '../services/supabase';
import { printOrder } from '../services/printService';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
    Plus, Trash2, Save, LayoutGrid, Edit, X,
    Users, Move, Eye, Settings, RefreshCw, Receipt, DollarSign, ShoppingCart,
    CreditCard, Banknote, Smartphone
} from 'lucide-react';

// ============================================================
// TIPOS
// ============================================================

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'unavailable';

export interface Table {
    id: string;
    name: string;
    capacity: number;
    position_x: number;
    position_y: number;
    width: number;
    height: number;
    status: TableStatus;
    current_order_id?: string;
    company_id?: string;
}

const STATUS_CONFIG: Record<TableStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
    available: { label: 'Disponible', color: 'text-green-700', bgColor: 'bg-green-500', borderColor: 'border-green-600' },
    occupied: { label: 'Ocupada', color: 'text-blue-700', bgColor: 'bg-blue-500', borderColor: 'border-blue-600' },
    reserved: { label: 'Reservada', color: 'text-purple-700', bgColor: 'bg-purple-500', borderColor: 'border-purple-600' },
    unavailable: { label: 'No disponible', color: 'text-amber-700', bgColor: 'bg-amber-400', borderColor: 'border-amber-500' },
};

// ============================================================
// COMPONENTE TICKET DE MESA (Para impresión térmica)
// ============================================================

interface TableTicketProps {
    order: any;
    table: Table;
    companyName?: string;
}

const TableTicket = forwardRef<HTMLDivElement, TableTicketProps>(({ order, table, companyName }, ref) => {
    if (!order || !table) return null;

    return (
        <div ref={ref} className="hidden print:block p-1 bg-white text-black font-mono text-[10px] w-[58mm] mx-auto leading-tight">
            {/* HEADER */}
            <div className="text-center mb-4 border-b border-black pb-2 border-dashed">
                <h2 className="font-black text-lg uppercase leading-none mb-1">
                    {companyName || 'Mi Negocio'}
                </h2>
                <p className="text-[10px]">
                    {new Date().toLocaleDateString('es-AR')} - {new Date().toLocaleTimeString('es-AR')}
                </p>
            </div>

            {/* MESA */}
            <div className="text-center font-black text-base border-2 border-black py-1 mb-2">
                {table.name}
            </div>

            {/* TICKET NUMBER */}
            <div className="flex justify-between items-center font-bold text-base mb-2 border-b border-dashed border-black pb-2">
                <span>TICKET:</span>
                <span>#{order.ticket_number || 'N/A'}</span>
            </div>

            {/* CONSUMO */}
            <div className="border-b border-black border-dashed py-2 mb-3">
                <p className="font-bold text-xs mb-2 uppercase">Consumo:</p>
                <ul className="space-y-2">
                    {order.order_items?.map((item: any, index: number) => {
                        const displayName = item.item_name || item.products?.name || 'Producto';
                        const precio = item.quantity * (item.price_at_moment || item.unit_price || item.products?.price || 0);
                        return (
                            <li key={index} className="flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium uppercase block">
                                        {item.quantity} x {displayName}
                                    </span>
                                    {item.notes && (
                                        <span className="text-[10px] text-gray-600 italic leading-tight block">
                                            ({item.notes})
                                        </span>
                                    )}
                                </div>
                                <span className="font-bold text-sm">
                                    ${precio.toLocaleString('es-AR')}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </div>

            {/* TOTAL */}
            <div className="border-t-2 border-black pt-2 mb-3">
                <div className="flex justify-between items-center font-black text-lg">
                    <span>TOTAL</span>
                    <span>${order.total?.toLocaleString('es-AR') || 0}</span>
                </div>
            </div>

            {/* FOOTER */}
            <div className="text-center text-xs font-bold mt-3 pt-2 border-t border-dashed border-black">
                <p>¡Gracias por su visita!</p>
                <p className="mt-1">*** TICKET NO FISCAL ***</p>
            </div>
        </div>
    );
});

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

interface TableLayoutProps {
    onAddProducts?: (table: any, existingOrder: any) => void;
}

export default function TableLayout({ onAddProducts }: TableLayoutProps) {
    const { userProfile } = useApp();
    const [tables, setTables] = useState<Table[]>([]);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [selectedTable, setSelectedTable] = useState<Table | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [tableOrder, setTableOrder] = useState<any>(null); // Pedido de la mesa seleccionada
    const [loadingOrder, setLoadingOrder] = useState(false);
    const [showPaymentSelector, setShowPaymentSelector] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const dragOffset = useRef({ x: 0, y: 0 });

    // Ref para impresión del ticket
    const ticketRef = useRef<HTMLDivElement>(null);

    // Hook de impresión (similar a Kitchen)
    const handlePrintTicket = useReactToPrint({
        contentRef: ticketRef,
        documentTitle: selectedTable ? `Ticket-${selectedTable.name}` : 'Ticket',
    });

    // Estado para crear nueva mesa
    const [newTableData, setNewTableData] = useState({
        name: '',
        capacity: 4
    });

    // ----------------------------------------------------------
    // CARGAR MESAS
    // ----------------------------------------------------------

    useEffect(() => {
        if (userProfile) {
            fetchTables();
        }
    }, [userProfile]);

    const fetchTables = async () => {
        setLoading(true);
        const companyId = userProfile?.company_id || (userProfile as any)?.companies?.id;

        try {
            const { data, error } = await supabase
                .from('tables')
                .select('*')
                .eq('company_id', companyId)
                .order('name');

            if (error) throw error;
            setTables(data || []);
        } catch (err: any) {
            console.error('Error cargando mesas:', err);
            // Si no existe la tabla, usar datos demo
            setTables([
                { id: '1', name: 'Mesa 1', capacity: 4, position_x: 50, position_y: 50, width: 80, height: 80, status: 'available' },
                { id: '2', name: 'Mesa 2', capacity: 2, position_x: 150, position_y: 50, width: 80, height: 80, status: 'occupied' },
                { id: '3', name: 'Mesa 3', capacity: 6, position_x: 250, position_y: 50, width: 100, height: 80, status: 'available' },
                { id: '4', name: 'Mesa 4', capacity: 4, position_x: 50, position_y: 150, width: 80, height: 80, status: 'available' },
                { id: '5', name: 'Mesa 5', capacity: 8, position_x: 150, position_y: 150, width: 120, height: 80, status: 'reserved' },
            ]);
        } finally {
            setLoading(false);
        }
    };

    // ----------------------------------------------------------
    // DRAG & DROP CON MOUSE EVENTS (FLUIDO)
    // ----------------------------------------------------------

    const handleMouseDown = useCallback((e: React.MouseEvent, tableId: string) => {
        if (!editMode) return;
        e.preventDefault();

        const table = tables.find(t => t.id === tableId);
        if (!table || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        dragOffset.current = {
            x: e.clientX - rect.left - table.position_x,
            y: e.clientY - rect.top - table.position_y
        };

        setDraggingId(tableId);
    }, [editMode, tables]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!draggingId || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const newX = Math.max(0, e.clientX - rect.left - dragOffset.current.x);
        const newY = Math.max(0, e.clientY - rect.top - dragOffset.current.y);

        setTables(prev => prev.map(t =>
            t.id === draggingId
                ? { ...t, position_x: newX, position_y: newY }
                : t
        ));
    }, [draggingId]);

    const handleMouseUp = useCallback(async () => {
        if (!draggingId) return;

        const table = tables.find(t => t.id === draggingId);
        if (table) {
            try {
                await supabase
                    .from('tables')
                    .update({ position_x: table.position_x, position_y: table.position_y })
                    .eq('id', draggingId);
            } catch (err) {
                console.error('Error guardando posición:', err);
            }
        }

        setDraggingId(null);
    }, [draggingId, tables]);

    // Event listeners globales para el arrastre
    useEffect(() => {
        if (draggingId) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [draggingId, handleMouseMove, handleMouseUp]);

    // ----------------------------------------------------------
    // CRUD MESAS
    // ----------------------------------------------------------

    const handleAddTable = async () => {
        if (!newTableData.name.trim()) {
            toast.error('Ingresa un nombre para la mesa');
            return;
        }

        const newTable: Table = {
            id: `temp-${Date.now()}`,
            name: newTableData.name,
            capacity: newTableData.capacity,
            position_x: 100 + Math.random() * 200,
            position_y: 100 + Math.random() * 200,
            width: 80,
            height: 80,
            status: 'available'
        };

        try {
            const { data, error } = await supabase
                .from('tables')
                .insert([{
                    name: newTable.name,
                    capacity: newTable.capacity,
                    position_x: newTable.position_x,
                    position_y: newTable.position_y,
                    width: newTable.width,
                    height: newTable.height,
                    status: 'available',
                    company_id: userProfile?.company_id
                }])
                .select()
                .single();

            if (error) throw error;
            setTables(prev => [...prev, data]);
            toast.success(`Mesa "${newTable.name}" creada`);
        } catch (err: any) {
            console.error('Error creando mesa:', err);
            toast.error('Error al crear mesa: ' + err.message);
        }

        setNewTableData({ name: '', capacity: 4 });
    };

    const handleDeleteTable = async (tableId: string) => {
        const table = tables.find(t => t.id === tableId);
        if (!table) return;

        if (!confirm(`¿Eliminar "${table.name}"?`)) return;

        try {
            await supabase.from('tables').delete().eq('id', tableId);
            setTables(prev => prev.filter(t => t.id !== tableId));
            toast.success('Mesa eliminada');
        } catch (err) {
            setTables(prev => prev.filter(t => t.id !== tableId));
            toast.success('Mesa eliminada (modo demo)');
        }

        setShowEditModal(false);
        setSelectedTable(null);
    };

    const handleUpdateTable = async () => {
        if (!selectedTable) return;

        try {
            await supabase
                .from('tables')
                .update({
                    name: selectedTable.name,
                    capacity: selectedTable.capacity,
                    status: selectedTable.status
                })
                .eq('id', selectedTable.id);

            setTables(prev => prev.map(t =>
                t.id === selectedTable.id ? selectedTable : t
            ));
            toast.success('Mesa actualizada');
        } catch (err) {
            setTables(prev => prev.map(t =>
                t.id === selectedTable.id ? selectedTable : t
            ));
            toast.success('Mesa actualizada (modo demo)');
        }

        setShowEditModal(false);
        setSelectedTable(null);
    };

    const handleChangeStatus = async (tableId: string, newStatus: TableStatus) => {
        try {
            await supabase.from('tables').update({ status: newStatus }).eq('id', tableId);
            setTables(prev => prev.map(t =>
                t.id === tableId ? { ...t, status: newStatus } : t
            ));
        } catch (err) {
            setTables(prev => prev.map(t =>
                t.id === tableId ? { ...t, status: newStatus } : t
            ));
        }
    };

    // Cargar pedido de una mesa ocupada
    const loadTableOrder = async (table: Table) => {
        if (!table.current_order_id) {
            setTableOrder(null);
            return;
        }

        setLoadingOrder(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*, order_items(*, products(name, price))')
                .eq('id', table.current_order_id)
                .single();

            if (error) throw error;
            setTableOrder(data);
        } catch (err) {
            console.error('Error cargando pedido:', err);
            setTableOrder(null);
        } finally {
            setLoadingOrder(false);
        }
    };

    // Generar e imprimir ticket
    const printTableTicket = async () => {
        if (!tableOrder || !selectedTable) return;

        const printed = await printOrder({
            ...tableOrder,
            companyName: userProfile?.companies?.name || 'FLUXO',
            table: selectedTable,
        });

        if (!printed) {
            // Fallback: impresión del navegador
            handlePrintTicket();
        }
    };

    // Liberar mesa - cambia estado y registra método de pago
    const handleReleaseTable = async (paymentMethod: string) => {
        if (!selectedTable) return;

        try {
            // Cambiar estado de la mesa a disponible
            await supabase
                .from('tables')
                .update({
                    status: 'available',
                    current_order_id: null
                })
                .eq('id', selectedTable.id);

            // Si hay un pedido asociado, marcarlo como completado y guardar método de pago
            if (selectedTable.current_order_id) {
                await supabase
                    .from('orders')
                    .update({
                        status: 'completed',
                        payment_type: paymentMethod
                    })
                    .eq('id', selectedTable.current_order_id);
            }

            setTables(prev => prev.map(t =>
                t.id === selectedTable.id
                    ? { ...t, status: 'available', current_order_id: undefined }
                    : t
            ));

            const methodLabels: Record<string, string> = {
                efectivo: 'Efectivo',
                tarjeta: 'Tarjeta',
                transferencia: 'Transferencia',
                mercadopago: 'MercadoPago'
            };
            toast.success(`${selectedTable.name} cobrada (${methodLabels[paymentMethod] || paymentMethod}) y liberada`);
            setShowEditModal(false);
            setSelectedTable(null);
            setTableOrder(null);
            setShowPaymentSelector(false);
        } catch (err) {
            console.error('Error liberando mesa:', err);
            toast.error('Error al liberar mesa');
        }
    };

    // Cargar pedido cuando se selecciona una mesa ocupada
    useEffect(() => {
        if (selectedTable && selectedTable.status === 'occupied') {
            loadTableOrder(selectedTable);
        } else {
            setTableOrder(null);
        }
    }, [selectedTable]);

    // ----------------------------------------------------------
    // RENDER
    // ----------------------------------------------------------

    return (
        <>
            {/* Componente de ticket oculto para impresión */}
            {selectedTable && tableOrder && (
                <TableTicket
                    ref={ticketRef}
                    order={tableOrder}
                    table={selectedTable}
                    companyName={userProfile?.companies?.name}
                />
            )}

            <div className="h-full flex flex-col bg-gray-50 p-6">
                {/* HEADER */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                            <LayoutGrid size={32} className="text-orange-600" />
                            Mapa del Salón
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {editMode ? '🔧 Modo edición: arrastra las mesas para reorganizar' : 'Vista del estado de las mesas'}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={fetchTables}
                            className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 font-bold transition-colors"
                        >
                            <RefreshCw size={18} />
                        </button>

                        <button
                            onClick={() => setEditMode(!editMode)}
                            className={`px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 font-bold transition-colors ${editMode
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
                                }`}
                        >
                            {editMode ? <Eye size={18} /> : <Settings size={18} />}
                            {editMode ? 'Ver Mapa' : 'Editar Mapa'}
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex gap-6 overflow-hidden">
                    {/* MAPA DE MESAS */}
                    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative">
                        {/* Grid de fondo */}
                        <div
                            ref={containerRef}
                            className="absolute inset-0 overflow-auto"
                            style={{
                                backgroundImage: editMode
                                    ? 'radial-gradient(circle, #ddd 1px, transparent 1px)'
                                    : 'none',
                                backgroundSize: '20px 20px'
                            }}
                        >
                            {loading ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                                </div>
                            ) : (
                                tables.map((table) => (
                                    <div
                                        key={table.id}
                                        onMouseDown={(e) => handleMouseDown(e, table.id)}
                                        onClick={() => {
                                            if (!editMode && !draggingId) {
                                                setSelectedTable(table);
                                                setShowEditModal(true);
                                            }
                                        }}
                                        style={{
                                            position: 'absolute',
                                            left: table.position_x,
                                            top: table.position_y,
                                            width: table.width,
                                            height: table.height,
                                            userSelect: 'none',
                                            transition: draggingId === table.id ? 'none' : 'box-shadow 0.2s'
                                        }}
                                        className={`
                                        ${STATUS_CONFIG[table.status].bgColor}
                                        ${editMode ? 'cursor-move' : 'cursor-pointer'}
                                        rounded-lg shadow-lg flex flex-col items-center justify-center
                                        text-white font-bold text-sm select-none
                                        border-2 ${STATUS_CONFIG[table.status].borderColor}
                                        hover:shadow-xl
                                        ${draggingId === table.id ? 'shadow-2xl scale-105 z-50' : ''}
                                    `}
                                    >
                                        <span className="text-base">{table.name}</span>
                                        <span className="text-xs opacity-80 flex items-center gap-1">
                                            <Users size={10} /> {table.capacity}
                                        </span>

                                        {/* Indicador de edición */}
                                        {editMode && (
                                            <div className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md">
                                                <Move size={12} className="text-gray-500" />
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* PANEL LATERAL */}
                    <div className="w-72 flex flex-col gap-4">
                        {/* LEYENDA */}
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                            <h3 className="font-bold text-gray-700 mb-3">Leyenda</h3>
                            <div className="space-y-2">
                                {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                                    <div key={status} className="flex items-center gap-3">
                                        <div className={`w-6 h-6 rounded ${config.bgColor}`}></div>
                                        <span className="text-sm text-gray-600">{config.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* CREAR MESA (solo en modo edición) */}
                        {editMode && (
                            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                                <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                                    <Plus size={18} className="text-orange-500" /> Nueva Mesa
                                </h3>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        placeholder="Nombre (ej: Mesa 6)"
                                        value={newTableData.name}
                                        onChange={(e) => setNewTableData(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none"
                                    />
                                    <div className="flex gap-2 items-center">
                                        <label className="text-sm text-gray-600">Capacidad:</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="20"
                                            value={newTableData.capacity}
                                            onChange={(e) => setNewTableData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 1 }))}
                                            className="w-20 p-2 border border-gray-200 rounded-lg text-sm text-center"
                                        />
                                    </div>
                                    <button
                                        onClick={handleAddTable}
                                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Plus size={18} /> Agregar Mesa
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* RESUMEN */}
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                            <h3 className="font-bold text-gray-700 mb-3">Resumen</h3>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="bg-blue-50 rounded-lg p-2 text-center">
                                    <div className="font-bold text-blue-600">{tables.filter(t => t.status === 'available').length}</div>
                                    <div className="text-xs text-blue-500">Disponibles</div>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-2 text-center">
                                    <div className="font-bold text-blue-600">{tables.filter(t => t.status === 'occupied').length}</div>
                                    <div className="text-xs text-blue-500">Ocupadas</div>
                                </div>
                                <div className="bg-purple-50 rounded-lg p-2 text-center">
                                    <div className="font-bold text-purple-600">{tables.filter(t => t.status === 'reserved').length}</div>
                                    <div className="text-xs text-purple-500">Reservadas</div>
                                </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-100 text-center">
                                <span className="text-2xl font-bold text-gray-800">{tables.length}</span>
                                <span className="text-sm text-gray-500 ml-2">mesas totales</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* MODAL EDITAR/VER MESA */}
                {showEditModal && selectedTable && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                        >
                            {/* Header */}
                            <div className={`p-4 ${STATUS_CONFIG[selectedTable.status].bgColor} text-white flex justify-between items-center`}>
                                <h3 className="font-bold text-lg">{selectedTable.name}</h3>
                                <button onClick={() => { setShowEditModal(false); setSelectedTable(null); }} className="hover:bg-white/20 p-1 rounded">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-5 space-y-4">
                                {/* Info */}
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Capacidad:</span>
                                    <div className="flex items-center gap-2">
                                        <Users size={16} className="text-gray-400" />
                                        <input
                                            type="number"
                                            min="1"
                                            max="20"
                                            value={selectedTable.capacity}
                                            onChange={(e) => setSelectedTable({ ...selectedTable, capacity: parseInt(e.target.value) || 1 })}
                                            className="w-16 p-1 border rounded text-center"
                                        />
                                        <span className="text-sm text-gray-500">personas</span>
                                    </div>
                                </div>

                                {/* Nombre */}
                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Nombre</label>
                                    <input
                                        type="text"
                                        value={selectedTable.name}
                                        onChange={(e) => setSelectedTable({ ...selectedTable, name: e.target.value })}
                                        className="w-full p-2.5 border rounded-lg"
                                    />
                                </div>

                                {/* Pedido de la mesa (solo si está ocupada) */}
                                {selectedTable.status === 'occupied' && (
                                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                                        <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                                            <Receipt size={16} className="text-green-600" />
                                            Consumo Actual
                                        </h4>
                                        {loadingOrder ? (
                                            <div className="text-center py-4 text-gray-400">
                                                Cargando...
                                            </div>
                                        ) : tableOrder ? (
                                            <div className="space-y-2">
                                                {tableOrder.order_items?.map((item: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between text-sm">
                                                        <span className="text-gray-600">
                                                            {item.quantity}x {item.products?.name || item.product_name}
                                                        </span>
                                                        <span className="font-bold text-gray-800">
                                                            ${(item.quantity * (item.unit_price || item.products?.price || 0)).toLocaleString()}
                                                        </span>
                                                    </div>
                                                ))}
                                                <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
                                                    <span className="font-bold text-gray-700">Total</span>
                                                    <span className="font-bold text-green-600 text-lg">
                                                        ${tableOrder.total?.toLocaleString() || 0}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-2 text-gray-400 text-sm">
                                                Sin consumo registrado
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Cambiar Estado (solo en modo edición o si no está ocupada) */}
                                {(editMode || selectedTable.status !== 'occupied') && (
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-2">Estado</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                                                <button
                                                    key={status}
                                                    onClick={() => setSelectedTable({ ...selectedTable, status: status as TableStatus })}
                                                    className={`p-2 rounded-lg text-xs font-bold transition-all border-2 ${selectedTable.status === status
                                                        ? `${config.bgColor} text-white ${config.borderColor}`
                                                        : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {config.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Acciones */}
                                <div className="flex flex-col gap-2 pt-2">
                                    {selectedTable.status === 'occupied' ? (
                                        <>
                                            {/* Botón Agregar Productos */}
                                            {onAddProducts && (
                                                <button
                                                    onClick={() => {
                                                        onAddProducts(selectedTable, tableOrder);
                                                        setShowEditModal(false);
                                                    }}
                                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <ShoppingCart size={18} /> Agregar Productos
                                                </button>
                                            )}
                                            {/* Selector de método de pago */}
                                            {showPaymentSelector ? (
                                                <div className="border-2 border-green-200 rounded-xl p-3 bg-green-50">
                                                    <p className="text-sm font-bold text-green-800 mb-2 text-center">¿Cómo abona el cliente?</p>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <button
                                                            onClick={() => handleReleaseTable('efectivo')}
                                                            className="flex items-center justify-center gap-2 p-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold transition-colors text-sm"
                                                        >
                                                            <Banknote size={18} /> Efectivo
                                                        </button>
                                                        <button
                                                            onClick={() => handleReleaseTable('tarjeta')}
                                                            className="flex items-center justify-center gap-2 p-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors text-sm"
                                                        >
                                                            <CreditCard size={18} /> Tarjeta
                                                        </button>
                                                        <button
                                                            onClick={() => handleReleaseTable('transferencia')}
                                                            className="flex items-center justify-center gap-2 p-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold transition-colors text-sm"
                                                        >
                                                            <Smartphone size={18} /> Transfer.
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => setShowPaymentSelector(false)}
                                                        className="w-full mt-2 text-xs text-gray-500 hover:text-gray-700 py-1"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => { setShowEditModal(false); setSelectedTable(null); setShowPaymentSelector(false); }}
                                                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl transition-colors"
                                                    >
                                                        Cerrar
                                                    </button>
                                                    <button
                                                        onClick={() => setShowPaymentSelector(true)}
                                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                                                    >
                                                        <DollarSign size={18} /> Cobrar y Liberar
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleDeleteTable(selectedTable.id)}
                                                className="flex-1 bg-red-100 hover:bg-red-200 text-red-600 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Trash2 size={18} /> Eliminar
                                            </button>
                                            <button
                                                onClick={handleUpdateTable}
                                                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Save size={18} /> Guardar
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </div>
        </>
    );
}
