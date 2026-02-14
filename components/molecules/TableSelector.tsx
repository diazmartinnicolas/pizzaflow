import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { LayoutGrid, Users, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext';

// ============================================================
// TIPOS
// ============================================================

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'unavailable';

export interface Table {
    id: string;
    name: string;
    capacity: number;
    status: TableStatus;
}

interface TableSelectorProps {
    selectedTable: Table | null;
    onSelectTable: (table: Table | null) => void;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    available: { bg: 'bg-green-500', text: 'text-green-700', border: 'border-green-500' },
    occupied: { bg: 'bg-blue-500', text: 'text-blue-700', border: 'border-blue-500' },
    reserved: { bg: 'bg-purple-500', text: 'text-purple-700', border: 'border-purple-500' },
    unavailable: { bg: 'bg-amber-400', text: 'text-amber-700', border: 'border-amber-400' },
};

const DEFAULT_STATUS_COLOR = { bg: 'bg-gray-400', text: 'text-gray-600', border: 'border-gray-400' };

// ============================================================
// COMPONENTE
// ============================================================

export const TableSelector: React.FC<TableSelectorProps> = ({
    selectedTable,
    onSelectTable
}) => {
    const { userProfile } = useApp();
    const [tables, setTables] = useState<Table[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDropdown, setShowDropdown] = useState(false);

    useEffect(() => {
        if (userProfile) {
            fetchTables();
        }
    }, [userProfile]);

    const fetchTables = async () => {
        const companyId = userProfile?.company_id || (userProfile as any)?.companies?.id;

        try {
            const { data, error } = await supabase
                .from('tables')
                .select('id, name, capacity, status')
                .eq('company_id', companyId);

            if (error) throw error;

            // Ordenamiento NUMÉRICO natural (Mesa 1, Mesa 2, Mesa 10...)
            const sortedData = (data || []).sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
            );

            setTables(sortedData);
        } catch (err) {
            // Datos demo si no existe la tabla
            setTables([
                { id: '1', name: 'Mesa 1', capacity: 4, status: 'available' },
                { id: '2', name: 'Mesa 2', capacity: 2, status: 'occupied' },
                { id: '3', name: 'Mesa 3', capacity: 6, status: 'available' },
                { id: '4', name: 'Mesa 4', capacity: 4, status: 'available' },
                { id: '5', name: 'Mesa 5', capacity: 8, status: 'reserved' },
                { id: '6', name: 'Mesa 6', capacity: 4, status: 'available' },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const availableTables = tables.filter(t => t.status === 'available');

    return (
        <div className="relative">
            {/* Campo de selección */}
            <div
                onClick={() => setShowDropdown(!showDropdown)}
                className={`
          flex items-center justify-between gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all
          ${selectedTable
                        ? `bg-blue-50 ${(STATUS_COLORS[selectedTable.status] || DEFAULT_STATUS_COLOR).border}`
                        : 'bg-white border-gray-200 hover:border-orange-300'
                    }
        `}
            >
                <div className="flex items-center gap-2">
                    <LayoutGrid size={18} className={selectedTable ? (STATUS_COLORS[selectedTable.status] || DEFAULT_STATUS_COLOR).text : 'text-gray-400'} />
                    {selectedTable ? (
                        <span className="font-bold text-gray-800">
                            {selectedTable.name}
                            <span className="text-xs text-gray-500 ml-2 font-normal">
                                ({selectedTable.capacity} personas)
                            </span>
                        </span>
                    ) : (
                        <span className="text-gray-400">Seleccionar mesa...</span>
                    )}
                </div>

                {selectedTable && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelectTable(null);
                        }}
                        className="p-1 hover:bg-red-100 rounded-full text-red-500"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Dropdown */}
            <AnimatePresence>
                {showDropdown && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-2xl border border-gray-200 z-[100] overflow-hidden"
                    >
                        <div className="p-2 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-tight">
                                {availableTables.length} mesas disponibles
                            </p>
                            <LayoutGrid size={14} className="text-gray-400" />
                        </div>

                        <div className="max-h-48 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                            {loading ? (
                                <div className="py-4 text-center text-gray-400 text-sm">
                                    Cargando mesas...
                                </div>
                            ) : tables.length === 0 ? (
                                <div className="py-4 text-center text-gray-400 text-sm">
                                    No hay mesas configuradas
                                </div>
                            ) : (
                                <div className="grid grid-cols-4 gap-2 pb-4">
                                    {tables.map((table) => {
                                        const isAvailable = table.status === 'available';
                                        const isSelected = selectedTable?.id === table.id;
                                        const statusColor = STATUS_COLORS[table.status] || DEFAULT_STATUS_COLOR;

                                        return (
                                            <button
                                                key={table.id}
                                                disabled={!isAvailable && !isSelected}
                                                onClick={() => {
                                                    if (isAvailable || isSelected) {
                                                        onSelectTable(isSelected ? null : table);
                                                        setShowDropdown(false);
                                                    }
                                                }}
                                                className={`
                                                  p-2 rounded-lg text-center transition-all relative flex flex-col items-center justify-center min-h-[55px]
                                                  ${isSelected
                                                        ? 'bg-orange-500 text-white shadow ring-2 ring-orange-200'
                                                        : isAvailable
                                                            ? `${statusColor.bg} text-white shadow-sm hover:opacity-90`
                                                            : `${statusColor.bg} text-white opacity-30 cursor-not-allowed`
                                                    }
                                                `}
                                            >
                                                <div className="font-bold text-[10px] uppercase truncate w-full px-1">{table.name}</div>
                                                <div className="text-[9px] bg-black/10 px-1.5 rounded-full flex items-center justify-center gap-0.5 font-bold mt-0.5">
                                                    <Users size={8} /> {table.capacity}
                                                </div>

                                                {isSelected && (
                                                    <div className="absolute -top-0.5 -right-0.5 bg-white rounded-full p-0.5 shadow-sm">
                                                        <Check size={10} className="text-orange-600" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-2 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => setShowDropdown(false)}
                                className="w-full text-xs text-gray-500 hover:text-gray-700 py-1"
                            >
                                Cerrar
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Overlay para cerrar */}
            {showDropdown && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDropdown(false)}
                />
            )}
        </div>
    );
};

export default TableSelector;
