import React from 'react';
import { Banknote, QrCode, CreditCard } from 'lucide-react';

// ============================================================
// TIPOS
// ============================================================

export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta';

interface PaymentMethodSelectorProps {
    selected: PaymentMethod;
    onChange: (method: PaymentMethod) => void;
}

interface PaymentOption {
    id: PaymentMethod;
    label: string;
    icon: React.ReactNode;
    activeColor: string;
}

// ============================================================
// CONFIGURACIÓN
// ============================================================

const paymentOptions: PaymentOption[] = [
    {
        id: 'efectivo',
        label: 'Efectivo',
        icon: <Banknote size={20} />,
        activeColor: 'bg-gray-800 text-white border-gray-800',
    },
    {
        id: 'transferencia',
        label: 'Transf.',
        icon: <QrCode size={20} />,
        activeColor: 'bg-blue-600 text-white border-blue-600',
    },
    {
        id: 'tarjeta',
        label: 'Tarjeta',
        icon: <CreditCard size={20} />,
        activeColor: 'bg-purple-600 text-white border-purple-600',
    },
];

// ============================================================
// COMPONENTE
// ============================================================

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
    selected,
    onChange,
}) => {
    return (
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Método de pago">
            {paymentOptions.map((option) => {
                const isSelected = selected === option.id;

                return (
                    <button
                        key={option.id}
                        onClick={() => onChange(option.id)}
                        role="radio"
                        aria-checked={isSelected}
                        className={`
              flex flex-row items-center justify-center gap-1.5
              p-1.5 rounded-lg border transition-all
              ${isSelected
                                ? option.activeColor
                                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                            }
            `}
                    >
                        <span className="scale-90">{option.icon}</span>
                        <span className="text-[9px] font-bold uppercase">
                            {option.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default PaymentMethodSelector;
