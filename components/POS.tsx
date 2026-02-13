import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ShoppingCart, Tag, Receipt, X, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../services/supabase';
import { useReactToPrint } from 'react-to-print';

// Contextos
import { useApp } from '../context/AppContext';
import { useCartContext, PaymentMethod } from '../context/CartContext';

// Hooks
import { useCart } from '../hooks/useCart';
import { useCustomerSelector } from '../hooks/useCustomerSelector';

// Componentes
import { Button } from './atoms/Button';
import { SearchInput } from './atoms/Input';
import { ProductCard } from './molecules/ProductCard';
import { CartItem } from './molecules/CartItem';
import { PaymentMethodSelector } from './molecules/PaymentMethodSelector';
import { CustomerSelector } from './molecules/CustomerSelector';
import { OrderTypeSelector, OrderType, DeliveryForm, DeliveryInfo, CategoryTabs, TableSelector } from './molecules';

// Tipos
import { Product, Customer } from '../types';

// Utilidades
import { calculateHalfHalfPrice } from '../utils/pricing';

// ============================================================
// CONSTANTES
// ============================================================

const CATEGORIES = [
  'Todo',
  'Promociones',
  'Pizzas',
  'Milanesas',
  'Hamburguesas',
  'Empanadas',
  'Ensaladas',
  'Mitades',
  'Bebidas',
  'Postres',
  'Otros'
];

const EMPANADA_FLAVORS = [
  'Carne', 'Pollo', 'Jamón y Queso', 'Cebolla y Queso',
  'Apio y Roquefort', 'Humita', 'Calabresa', 'Caprese',
  'Verdura', 'Carne Picante', 'Panceta y Ciruela',
  'Bondiola', 'Pollo Puerro Champignones', 'Roquefort y Jamón'
];

// ============================================================
// COMPONENTE PRINCIPAL: POS
// ============================================================

interface POSProps {
  isDemo?: boolean;
  onDemoOrder?: (order: any) => void;
  initialTable?: { table: any; existingOrder: any } | null;
  onTableProcessed?: () => void;
}

// --- COMPONENTE TICKET TÉRMICO DE COCINA (Visible solo al imprimir) ---
const KitchenTicket = React.forwardRef<HTMLDivElement, { order: any; companyName?: string }>(({ order, companyName }, ref) => {
  if (!order) return null;

  const paymentMethod = order.payment_type ? order.payment_type.toUpperCase() : 'EFECTIVO';

  const sortedItems = [...(order.order_items || [])].sort((a: any, b: any) => {
    const catA = a.product?.category || '';
    const catB = b.product?.category || '';
    const nameA = a.product?.name || '';
    const nameB = b.product?.name || '';

    const catComparison = catA.localeCompare(catB);
    if (catComparison !== 0) return catComparison;
    return nameA.localeCompare(nameB);
  });

  return (
    <div ref={ref} className="hidden print:block p-2 bg-white text-black font-mono text-[12px] w-[58mm] mx-auto leading-normal">
      <style>{`
        @page { 
          margin: 0; 
          size: 58mm auto;
        }
        @media print {
          body { 
            margin: 0; 
            padding: 0;
            -webkit-print-color-adjust: exact;
          }
          .ticket-dashed {
            border-bottom: 1px dashed black;
          }
        }
      `}</style>

      {/* Header */}
      <div className="text-center mb-2">
        <h2 className="font-bold text-base uppercase leading-tight">
          {companyName || 'FLUXO'}
        </h2>
        <p className="text-[10px]">
          {new Date().toLocaleDateString('es-AR')} - {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      <div className="border-b-[1px] border-black border-double mb-2"></div>

      {/* Ticket Number */}
      <div className="flex justify-between font-bold text-sm mb-1 uppercase">
        <span>TICKET:</span>
        <span>#{order.ticket_number}</span>
      </div>

      <div className="border-b border-black border-dashed mb-1"></div>

      {/* Type & Payment Info */}
      <div className="mb-1 text-sm font-bold uppercase">
        {order.order_type === 'delivery' ? '[DELIVERY]' : order.order_type === 'takeaway' ? '[P/LLEVAR]' : '[MESA]'}
        {' '}[{paymentMethod}]
      </div>

      <div className="border-b-[1px] border-black border-double mb-2"></div>

      {/* Table info */}
      {order.table && (
        <div className="mb-2">
          <p className="font-bold uppercase">MESA: {order.table.name || order.table.id}</p>
          <div className="border-b border-black border-dashed mt-1"></div>
        </div>
      )}

      {/* Cliente / Dirección */}
      <div className="text-xs uppercase mb-2">
        <p className="font-bold">CLIENTE / DIRECCION:</p>
        <p className="text-sm font-black">{order.client?.name || 'Mostrador'}</p>
        {order.delivery_address && (
          <p className="text-xs mt-0.5 font-bold leading-tight">📍 {order.delivery_address}</p>
        )}
        {(order.delivery_phone || order.client?.phone) && (
          <div className="mt-1">
            <p className="font-bold">TELEFONO:</p>
            <p className="text-sm">{order.delivery_phone || order.client?.phone}</p>
          </div>
        )}
      </div>

      <div className="border-b-[1px] border-black border-double mb-2"></div>

      {/* Items */}
      <div className="mb-2">
        <ul className="space-y-2">
          {sortedItems.map((item: any, index: number) => (
            <li key={index} className="flex flex-col">
              <div className="flex gap-1 items-start">
                <span className="font-black text-sm">{item.quantity}</span>
                <span className="mx-0.5">x</span>
                <span className="flex-1 text-sm font-black uppercase">
                  {item.item_name || item.product?.name}
                </span>
              </div>
              {item.notes && (
                <span className="text-[10px] ml-6 italic block">
                  ({item.notes})
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="border-b-[1px] border-black border-double mb-2 mt-2"></div>

      {/* Total */}
      <div className="flex justify-between items-center py-1 font-black text-base">
        <span>TOTAL:</span>
        <span>${Number(order.total || 0).toLocaleString('es-AR')}</span>
      </div>

      <div className="border-b-[1px] border-black border-double mb-3"></div>

      {/* Observaciones */}
      <div className="mb-4">
        <p className="text-[10px] font-bold mb-1">OBSERVACIONES:</p>
        <div className="w-full h-16 border border-black border-dashed rounded flex items-center justify-center">
          {/* Espacio para escribir a mano */}
        </div>
      </div>

      <div className="border-b border-black border-dashed mb-2"></div>

      <div className="text-center font-bold text-[10px] mt-2 pb-8">
        <p>*** FIN DE ORDEN ***</p>
      </div>
    </div>
  );
});

const POS: React.FC<POSProps> = ({ isDemo = false, onDemoOrder, initialTable, onTableProcessed }) => {
  // ----------------------------------------------------------
  // CONTEXTOS Y HOOKS
  // ----------------------------------------------------------

  const {
    products,
    customers,
    promotions,
    createOrder,
    createCustomer,
    toggleFavorite,
    session,
    userProfile
  } = useApp();

  const {
    paymentMethod,
    setPaymentMethod,
    isProcessing,
    setIsProcessing,
    resetCheckout
  } = useCartContext();

  const activePromotions = useMemo(
    () => promotions.filter(p => p.is_active),
    [promotions]
  );

  const {
    cart,
    groupedCart,
    addToCart,
    removeFromCart,
    removeOneFromCart,
    clearCart,
    totals
  } = useCart(activePromotions);

  const customerSelector = useCustomerSelector(customers);

  // ----------------------------------------------------------
  // ESTADO LOCAL
  // ----------------------------------------------------------

  const [selectedCategory, setSelectedCategory] = useState('Todo');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [mobileView, setMobileView] = useState<'products' | 'cart'>('products');
  const [firstHalf, setFirstHalf] = useState<Product | null>(null);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ name: '', address: '', phone: '' });

  // Estado para Empanadas
  const [showEmpanadaSelector, setShowEmpanadaSelector] = useState(false);
  const [currentEmpanadaProduct, setCurrentEmpanadaProduct] = useState<Product | null>(null);
  const [empanadaSelections, setEmpanadaSelections] = useState<Record<string, number>>({});

  // Estado para tipo de pedido y delivery
  const [orderType, setOrderType] = useState<OrderType>('local');
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo>({
    address: '',
    phone: '',
    notes: ''
  });
  const [selectedTable, setSelectedTable] = useState<any>(null);

  // Estado para impresión
  const [printingOrder, setPrintingOrder] = useState<any>(null);
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: printingOrder ? `Comanda-${printingOrder.ticket_number}` : 'Comanda',
  });

  // Auto-completar datos de delivery cuando se selecciona Delivery o cambia el cliente
  const selectedCustomer = customerSelector.selectedCustomer;
  useEffect(() => {
    if (orderType === 'delivery' && selectedCustomer) {
      // Siempre usar los datos del cliente cuando se selecciona delivery
      setDeliveryInfo({
        address: selectedCustomer.address || '',
        phone: selectedCustomer.phone || '',
        notes: '' // Limpiar notas al cambiar
      });
    } else if (!selectedCustomer) {
      // Si no hay cliente, limpiar los campos
      setDeliveryInfo({ address: '', phone: '', notes: '' });
    }
  }, [orderType, selectedCustomer]);

  // Efecto para cargar mesa desde el salón (para agregar productos)
  useEffect(() => {
    if (initialTable?.table) {
      setOrderType('local');
      setSelectedTable(initialTable.table);

      // Si hay un pedido existente, cargar los items al carrito
      if (initialTable.existingOrder?.order_items) {
        // Limpiar carrito primero
        clearCart();

        // Agregar cada item del pedido existente al carrito
        initialTable.existingOrder.order_items.forEach((item: any) => {
          const product = products.find(p => p.id === item.product_id);
          if (product) {
            for (let i = 0; i < item.quantity; i++) {
              addToCart(product);
            }
          }
        });
      }

      // Notificar que se procesó
      onTableProcessed?.();
    }
  }, [initialTable]);

  // ----------------------------------------------------------
  // PRODUCTOS FILTRADOS
  // ----------------------------------------------------------

  const filteredProducts = useMemo(() => {
    return products
      .filter(p => p.active)
      .filter(p => {
        if (selectedCategory === 'Todo') return true;
        if (selectedCategory === 'Mitades') {
          return p.category === 'Mitades' || p.name.toLowerCase().includes('mitad');
        }
        return p.category === selectedCategory;
      })
      .filter(p => {
        if (!productSearchTerm) return true;
        return p.name.toLowerCase().includes(productSearchTerm.toLowerCase());
      })
      .sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));
  }, [products, selectedCategory, productSearchTerm]);

  // ----------------------------------------------------------
  // HANDLERS
  // ----------------------------------------------------------

  const handleProductClick = useCallback((product: Product) => {
    const isHalf = product.category === 'Mitades' || product.name.toLowerCase().includes('mitad');

    if (!isHalf) {
      // Interceptar docenas, medias docenas o empanadas individuales para elegir gusto
      const isEmpanadaFlavorSelect = (product.category === 'Empanadas' ||
        product.name.toLowerCase().includes('empanada') ||
        product.name.toLowerCase().includes('clasica'));

      if (isEmpanadaFlavorSelect) {
        setCurrentEmpanadaProduct(product);
        setEmpanadaSelections({});
        setShowEmpanadaSelector(true);
        return;
      }

      addToCart(product);
      return;
    }

    // Lógica de mitades
    if (!firstHalf) {
      setFirstHalf(product);
      return;
    }

    const finalPrice = calculateHalfHalfPrice(firstHalf.price, product.price);
    const comboProduct: Product = {
      ...firstHalf,
      id: `combo-${Date.now()}`,
      name: `Pizza: ${firstHalf.name} / ${product.name}`,
      price: finalPrice,
      category: 'Pizzas',
    };

    addToCart(comboProduct);
    setFirstHalf(null);
  }, [addToCart, firstHalf]);

  const handleToggleFavorite = useCallback(async (productId: string) => {
    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      await toggleFavorite(productId, !!product.is_favorite);
    } catch (error: any) {
      toast.error("Error al marcar favorito");
    }
  }, [products, toggleFavorite]);

  const handleCheckout = useCallback(async (shouldPrint: boolean = false) => {
    // Validaciones según tipo de pedido
    if (cart.length === 0) {
      toast.error("Agrega productos al carrito");
      return;
    }

    // Para delivery, requerir dirección
    if (orderType === 'delivery' && !deliveryInfo.address) {
      toast.error("Ingresa la dirección de entrega");
      return;
    }

    setIsProcessing(true);

    // Modo demo
    if (isDemo && onDemoOrder) {
      setTimeout(() => {
        const todayKey = `fluxo_demo_ticket_${new Date().toISOString().split('T')[0]}`;
        const lastTicket = parseInt(localStorage.getItem(todayKey) || '0');
        const nextTicket = lastTicket + 1;
        localStorage.setItem(todayKey, nextTicket.toString());

        onDemoOrder({
          id: Date.now(),
          ticket_number: nextTicket,
          created_at: new Date().toISOString(),
          status: 'pendiente',
          order_type: orderType,
          client: { name: customerSelector.searchTerm },
          order_items: cart.map(i => ({ product: { name: i.name }, quantity: 1 }))
        });

        clearCart();
        customerSelector.clearSelection();
        resetCheckout();
        setMobileView('products');
        setOrderType('local');
        setDeliveryInfo({ address: '', phone: '', notes: '' });
        setIsProcessing(false);
        toast.success("¡Pedido demo enviado!");
      }, 600);
      return;
    }

    // Modo producción
    try {
      // Preparar los items del carrito para guardar en BD
      const orderItems = groupedCart.map((item: any) => {
        let productId = item.id;
        let itemName = item.name; // Guardar el nombre original del item (promo o producto)
        let itemDescription = item.description || ''; // Descripción con productos incluidos

        // Si es un combo de mitades, usar un producto de pizzas como referencia
        if (item.id.toString().startsWith('combo-')) {
          productId = products.find(p => p.category === 'Pizzas')?.id || products[0]?.id;
        }
        // Si es una promoción, buscar la promo original y usar su product_1_id
        else if (item.id.toString().startsWith('promo-')) {
          // Extraer el ID de la promoción del formato "promo-{promoId}-{timestamp}"
          const promoIdParts = item.id.toString().split('-');
          const promoId = promoIdParts.slice(1, -1).join('-'); // Remover "promo-" y el timestamp
          const originalPromo = promotions.find(p => p.id === promoId);
          productId = originalPromo?.product_1_id || products[0]?.id;
        }
        // Si es un producto personalizado con prefijo 'pack-' siguiendo el formato 'pack-{productId}-{timestamp}'
        else if (item.id.toString().startsWith('pack-')) {
          const idParts = item.id.toString().split('-');
          // El ID original está entre 'pack-' y el timestamp final
          productId = idParts.slice(1, -1).join('-');
        }

        return {
          product_id: productId,
          quantity: item.quantity,
          price_at_moment: item.price,
          item_name: itemName,
          notes: itemDescription
        };
      });

      // Crear el pedido con table_id si aplica
      // client_id debe ser null (no string vacío) si no hay cliente
      const orderData: any = {
        client_id: customerSelector.selectedCustomerId || null,
        total: totals.finalTotal,
        payment_type: paymentMethod,
        user_id: session.user.id,
        order_type: orderType,
        delivery_address: orderType === 'delivery' ? deliveryInfo.address : null,
        delivery_phone: orderType === 'delivery' ? deliveryInfo.phone : null,
        delivery_notes: orderType === 'delivery' ? deliveryInfo.notes : null,
        table_id: selectedTable?.id || null
      };

      const createdOrder = await createOrder(orderData, orderItems);

      // Si se solicitó imprimir, enviamos al servidor de impresión local (impresión silenciosa)
      if (shouldPrint && createdOrder) {
        const fullOrderForPrint = {
          ...createdOrder,
          companyName: userProfile?.companies?.name || 'FLUXO',
          client: selectedCustomer,
          table: selectedTable, // Agregar info de la mesa
          order_items: orderItems.map((item: any) => ({
            ...item,
            product: products.find(p => p.id === item.product_id)
          }))
        };

        // Intentar impresión silenciosa via servidor local
        try {
          const printResponse = await fetch('http://localhost:3001/print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fullOrderForPrint)
          });

          if (printResponse.ok) {
            toast.success('🖨️ Ticket enviado a impresora');
          } else {
            // Si falla el servidor local, usar impresión del navegador como fallback
            setPrintingOrder(fullOrderForPrint);
            setTimeout(() => handlePrint(), 300);
          }
        } catch (printError) {
          // Si no hay servidor de impresión, usar fallback del navegador
          console.log('Servidor de impresión no disponible, usando navegador');
          setPrintingOrder(fullOrderForPrint);
          setTimeout(() => handlePrint(), 300);
        }
      }

      // Si se seleccionó una mesa, marcarla como ocupada y asociar el pedido
      if (selectedTable && createdOrder?.id) {
        await supabase
          .from('tables')
          .update({
            status: 'occupied',
            current_order_id: createdOrder.id
          })
          .eq('id', selectedTable.id);
      }

      clearCart();
      customerSelector.clearSelection();
      resetCheckout();
      setMobileView('products');
      setOrderType('local');
      setDeliveryInfo({ address: '', phone: '', notes: '' });
      setSelectedTable(null);

      if (selectedTable) {
        toast.success(`¡Pedido enviado a ${selectedTable.name}!`);
      } else {
        toast.success("¡Pedido enviado con éxito!");
      }
    } catch (err: any) {
      toast.error("Error al procesar pedido: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [
    cart, customerSelector, isDemo, onDemoOrder,
    createOrder, totals, paymentMethod, session,
    groupedCart, products, promotions, clearCart, resetCheckout, setIsProcessing,
    orderType, deliveryInfo, selectedTable, handlePrint, selectedCustomer
  ]);

  const handleQuickCustomerCreate = useCallback(async () => {
    if (!newCustomerData.name || newCustomerData.name.length < 3) {
      toast.error("El nombre debe tener al menos 3 caracteres");
      return;
    }

    try {
      setIsProcessing(true);
      const company_id = userProfile?.company_id || (userProfile as any)?.companies?.id;

      const newCustomer = await createCustomer({
        name: newCustomerData.name,
        address: newCustomerData.address || null,
        phone: newCustomerData.phone || null,
        company_id: company_id,
        is_active: true
      });

      // Seleccionar el nuevo cliente automáticamente
      customerSelector.selectCustomer(newCustomer);

      toast.success("Cliente creado y seleccionado");
      setShowQuickCustomer(false);
      setNewCustomerData({ name: '', address: '', phone: '' });
    } catch (error: any) {
      toast.error("Error creando cliente: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  }, [newCustomerData]);

  // Lógica de validación de empanadas
  const empanadaTargetQty = useMemo(() => {
    if (!currentEmpanadaProduct) return { qty: 0, isFixed: false };
    const name = currentEmpanadaProduct.name.toLowerCase();
    if (name.includes('docena')) return { qty: 12, isFixed: true };
    if (name.includes('1/2')) return { qty: 6, isFixed: true };
    return { qty: 0, isFixed: false }; // Flexible para individuales
  }, [currentEmpanadaProduct]);

  const totalEmpanadasSelected = useMemo(() => {
    return Object.values(empanadaSelections).reduce((acc, curr) => acc + (curr || 0), 0);
  }, [empanadaSelections]);

  const handleConfirmEmpanadas = useCallback(() => {
    if (empanadaTargetQty.isFixed && totalEmpanadasSelected !== empanadaTargetQty.qty) {
      toast.error(`Selecciona exactamente ${empanadaTargetQty.qty} empanadas (tienes ${totalEmpanadasSelected})`);
      return;
    }

    if (totalEmpanadasSelected === 0) {
      toast.error("Selecciona al menos un gusto");
      return;
    }

    if (!currentEmpanadaProduct) return;

    const selectionsStr = Object.entries(empanadaSelections)
      .filter(([_, qty]) => qty > 0)
      .map(([flavor, qty]) => `${qty} ${flavor}`)
      .join(', ');

    const finalProduct = {
      ...currentEmpanadaProduct,
      id: `pack-${currentEmpanadaProduct.id}-${Date.now()}`,
      description: selectionsStr
    };

    // Si es un pack fijo (docena/media), agregamos 1 unidad del producto "pack"
    // Si es individual, agregamos tantas unidades como empanadas se seleccionaron
    if (empanadaTargetQty.isFixed) {
      addToCart(finalProduct);
    } else {
      for (let i = 0; i < totalEmpanadasSelected; i++) {
        // Usamos el mismo ID para que se agrupen en la vista del carrito
        addToCart(finalProduct);
      }
    }

    setShowEmpanadaSelector(false);
    setEmpanadaSelections({});
    setCurrentEmpanadaProduct(null);
  }, [totalEmpanadasSelected, empanadaTargetQty, empanadaSelections, currentEmpanadaProduct, addToCart]);

  // ----------------------------------------------------------
  // UTILIDADES
  // ----------------------------------------------------------

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* ========================================
          PANEL IZQUIERDO: PRODUCTOS
      ======================================== */}
      <section
        className={`flex-1 overflow-y-auto p-4 md:p-6 ${mobileView === 'cart' ? 'hidden md:block' : 'block'
          }`}
      >
        {/* Categorías */}
        <CategoryTabs
          categories={CATEGORIES}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => {
            setSelectedCategory(cat);
            setProductSearchTerm('');
          }}
        />

        {/* Buscador de productos */}
        <div className="my-4">
          <SearchInput
            placeholder="Buscar producto..."
            value={productSearchTerm}
            onChange={(e) => setProductSearchTerm(e.target.value)}
            onClear={() => setProductSearchTerm('')}
          />
        </div>

        {/* Indicador de mitad seleccionada */}
        {firstHalf && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm">
            <span className="font-bold text-orange-700">Primera mitad:</span>{' '}
            <span className="text-orange-600">{firstHalf.name}</span>
            <button
              onClick={() => setFirstHalf(null)}
              className="ml-2 text-orange-400 hover:text-orange-600"
            >
              (cancelar)
            </button>
          </div>
        )}

        {/* Grid de productos */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-24">
          {selectedCategory !== 'Promociones' && filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={handleProductClick}
              onToggleFavorite={handleToggleFavorite}
              isHalfMode={selectedCategory === 'Mitades'}
              isFirstHalfSelected={firstHalf?.id === product.id}
            />
          ))}

          {/* Promociones - Ahora clickeables */}
          {selectedCategory === 'Promociones' && promotions.map(promo => {
            // Obtener los productos de la promoción
            const product1 = products.find(p => p.id === promo.product_1_id);
            const product2 = products.find(p => p.id === promo.product_2_id);

            // Calcular precios
            const price1 = product1?.price || 0;
            const price2 = product2?.price || 0;

            let regularPrice = 0;
            let finalPrice = 0;

            if (promo.type === '2x1') {
              regularPrice = price1 * 2;
              finalPrice = price1;
            } else if (promo.type === 'fixed' && promo.fixed_price) {
              regularPrice = price1 + price2;
              finalPrice = promo.fixed_price;
            } else {
              regularPrice = price1 + price2;
              finalPrice = regularPrice - (regularPrice * (promo.discount_percentage / 100));
            }

            // Handler para agregar la promoción al carrito
            const handleAddPromoToCart = () => {
              // Crear un producto virtual que representa la promoción
              const promoProduct: Product = {
                id: `promo-${promo.id}-${Date.now()}`,
                name: promo.name,
                price: Math.round(finalPrice),
                category: 'Promociones',
                active: true,
                description: `${product1?.name || ''}${product2 ? ` + ${product2.name}` : promo.type === '2x1' ? ' (x2)' : ''}`
              };
              addToCart(promoProduct);
            };

            return (
              <div
                key={promo.id}
                onClick={handleAddPromoToCart}
                className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border-2 border-purple-100 hover:border-purple-300 hover:shadow-lg transition-all cursor-pointer group active:scale-95"
              >
                {/* Badge de tipo */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${promo.type === 'fixed' ? 'bg-orange-100 text-orange-700' :
                    promo.type === '2x1' ? 'bg-indigo-100 text-indigo-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                    {promo.type === 'fixed' ? 'Combo' : promo.type === '2x1' ? '2x1' : `${promo.discount_percentage}% OFF`}
                  </span>
                  <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    -${Math.round(regularPrice - finalPrice).toLocaleString()}
                  </span>
                </div>

                {/* Nombre */}
                <h3 className="font-bold text-purple-900 text-sm flex items-center gap-2 mb-2">
                  <Tag size={14} className="text-purple-500" /> {promo.name}
                </h3>

                {/* Productos incluidos */}
                <div className="text-[11px] text-gray-600 space-y-0.5 mb-3">
                  {product1 && (
                    <p className="truncate">• {product1.name}</p>
                  )}
                  {product2 && (
                    <p className="truncate">• {product2.name}</p>
                  )}
                  {promo.type === '2x1' && !product2 && (
                    <p className="text-indigo-600 italic">• (x2 del mismo)</p>
                  )}
                </div>

                {/* Precios */}
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-purple-700">
                    ${Math.round(finalPrice).toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-400 line-through">
                    ${regularPrice.toLocaleString()}
                  </span>
                </div>

                {/* Indicador de agregar */}
                <div className="mt-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs text-purple-600 font-medium">Click para agregar →</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================
          PANEL DERECHO: CARRITO
      ======================================== */}
      <aside
        className={`
          w-full md:w-96 bg-white border-l border-gray-200 
          flex flex-col h-full absolute md:static inset-0
          ${mobileView === 'products' ? 'hidden md:flex' : 'flex'}
        `}
      >
        {/* Selector de Cliente */}
        <div className="p-4 border-b bg-gray-50">
          <CustomerSelector
            customers={customers}
            selectedCustomer={customerSelector.selectedCustomer}
            searchTerm={customerSelector.searchTerm}
            showDropdown={customerSelector.showDropdown}
            filteredCustomers={customerSelector.filteredCustomers}
            onSearchChange={customerSelector.setSearchTerm}
            onSelectCustomer={customerSelector.selectCustomer}
            onClearSelection={customerSelector.clearSelection}
            onOpenDropdown={customerSelector.openDropdown}
            onCloseDropdown={customerSelector.closeDropdown}
            onCreateNew={() => setShowQuickCustomer(true)}
          />

          {/* COMPONENTE OCULTO PARA IMPRESIÓN */}
          <div className="hidden">
            <KitchenTicket
              ref={componentRef}
              order={printingOrder}
              companyName={userProfile?.companies?.name || 'FLUXO'}
            />
          </div>
        </div>

        {/* Header del carrito */}
        <div className="p-4 border-b border-gray-100 bg-white">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ShoppingCart size={20} className="text-orange-500" />
            Orden Actual
            {cart.length > 0 && (
              <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                {cart.length}
              </span>
            )}
          </h2>
        </div>

        {/* Lista de items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-20 text-gray-300">
              <ShoppingCart className="mx-auto opacity-20 mb-2" size={40} />
              <p>Nada por aquí</p>
            </div>
          ) : (
            groupedCart.map((item: any) => (
              <CartItem
                key={item.id}
                id={item.id}
                name={item.name}
                description={item.description}
                price={item.price}
                quantity={item.quantity || 1}
                subtotalPrice={item.subtotalPrice || item.price}
                onIncrease={() => addToCart(item)}
                onDecrease={() => removeOneFromCart(item.id)}
                onRemove={() => removeFromCart(item.id)}
              />
            ))
          )}
        </div>

        {/* Descuentos aplicados */}
        {totals.appliedDiscounts.length > 0 && (
          <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-100">
            <p className="text-xs font-bold text-yellow-700 mb-1 flex items-center gap-1">
              <Tag size={12} /> Promociones Aplicadas:
            </p>
            {totals.appliedDiscounts.map((d, i) => (
              <p key={i} className="text-xs text-yellow-600 ml-4">
                • {d.name} (-{formatPrice(d.amount)})
              </p>
            ))}
          </div>
        )}

        {/* Footer: Pago y Total */}
        <div className="p-3 border-t border-gray-100 bg-gray-50 space-y-3">
          {/* Selector de tipo de pedido */}
          <div>
            <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-tight">Tipo de Pedido</p>
            <OrderTypeSelector
              selected={orderType}
              onChange={(type) => {
                setOrderType(type);
                if (type !== 'delivery') {
                  setDeliveryInfo({ address: '', phone: '', notes: '' });
                }
                if (type !== 'local') {
                  setSelectedTable(null);
                }
              }}
            />
          </div>

          {/* Selector de Mesa (solo visible si es tipo local/mesa) */}
          {orderType === 'local' && (
            <div>
              <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-tight">Seleccionar Mesa</p>
              <TableSelector
                selectedTable={selectedTable}
                onSelectTable={setSelectedTable}
              />
            </div>
          )}

          {/* Información de envío EDITABLE para Delivery */}
          {orderType === 'delivery' && (
            <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 mb-2 space-y-2">
              <p className="text-xs font-bold text-orange-800 flex items-center gap-1">
                📍 Envío a:
              </p>
              <input
                type="text"
                placeholder="Dirección de entrega..."
                value={deliveryInfo.address}
                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, address: e.target.value })}
                className="w-full p-2 text-sm border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
              <input
                type="tel"
                placeholder="Teléfono..."
                value={deliveryInfo.phone}
                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, phone: e.target.value })}
                className="w-full p-2 text-sm border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            </div>
          )}

          {/* Selector de método de pago */}
          <PaymentMethodSelector
            selected={paymentMethod}
            onChange={setPaymentMethod}
          />

          {/* Totales */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>{formatPrice(totals.subtotal)}</span>
            </div>
            {totals.totalDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600 font-medium">
                <span>Descuento</span>
                <span>- {formatPrice(totals.totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-gray-900 font-bold text-lg">Total</span>
              <span className="text-2xl font-bold text-orange-600">
                {formatPrice(totals.finalTotal)}
              </span>
            </div>
          </div>

          {/* Botón Confirmar e Imprimir */}
          <Button
            variant="primary"
            size="md"
            fullWidth
            isLoading={isProcessing}
            disabled={
              cart.length === 0 ||
              (orderType === 'delivery' && !deliveryInfo.address)
            }
            onClick={() => handleCheckout(true)}
            className="flex items-center justify-center gap-2 py-2.5 h-auto text-sm"
          >
            <Printer size={16} />
            {isProcessing ? 'Procesando...' : 'Confirmar Pedido'}
          </Button>

          {/* Botón volver (móvil) */}
          {mobileView === 'cart' && (
            <button
              onClick={() => setMobileView('products')}
              className="w-full py-2 text-gray-500 font-medium"
            >
              Volver a productos
            </button>
          )}
        </div>
      </aside>

      {/* ========================================
          MODAL: Seleccionar Gustos Empanadas
      ======================================== */}
      {showEmpanadaSelector && currentEmpanadaProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <div>
                <h3 className="text-xl font-bold text-gray-800">{currentEmpanadaProduct.name}</h3>
                <p className={`text-sm font-medium ${empanadaTargetQty.isFixed
                  ? (totalEmpanadasSelected === empanadaTargetQty.qty ? 'text-green-600' : 'text-orange-600')
                  : 'text-orange-600'
                  }`}>
                  Seleccionado: {totalEmpanadasSelected} {empanadaTargetQty.isFixed ? `/ ${empanadaTargetQty.qty}` : ''}
                </p>
              </div>
              <button
                onClick={() => setShowEmpanadaSelector(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-2 mb-6 custom-scrollbar">
              {EMPANADA_FLAVORS.map(flavor => (
                <div key={flavor} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <span className="font-semibold text-gray-700">{flavor}</span>
                  <div className="flex items-center gap-3">
                    <button
                      className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
                      onClick={() => {
                        const current = empanadaSelections[flavor] || 0;
                        if (current > 0) {
                          setEmpanadaSelections({ ...empanadaSelections, [flavor]: current - 1 });
                        }
                      }}
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-bold text-orange-600 text-lg">
                      {empanadaSelections[flavor] || 0}
                    </span>
                    <button
                      className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white hover:bg-orange-600 active:scale-95 transition-all shadow-md"
                      onClick={() => {
                        const current = empanadaSelections[flavor] || 0;
                        if (!empanadaTargetQty.isFixed || totalEmpanadasSelected < empanadaTargetQty.qty) {
                          setEmpanadaSelections({ ...empanadaSelections, [flavor]: current + 1 });
                        } else {
                          toast.error(`Ya seleccionaste las ${empanadaTargetQty.qty} empanadas`);
                        }
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setShowEmpanadaSelector(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                fullWidth
                disabled={empanadaTargetQty.isFixed ? totalEmpanadasSelected !== empanadaTargetQty.qty : totalEmpanadasSelected === 0}
                onClick={handleConfirmEmpanadas}
              >
                Confirmar ({totalEmpanadasSelected})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================
          MODAL: Crear Cliente Rápido
      ======================================== */}
      {showQuickCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-sm">
            <h3 className="text-xl font-bold mb-4">Nuevo Cliente</h3>
            <div className="space-y-3 mb-6">
              <input
                className="w-full p-3 border rounded-lg"
                placeholder="Nombre"
                value={newCustomerData.name}
                onChange={e => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
              />
              <input
                className="w-full p-3 border rounded-lg"
                placeholder="Dirección"
                value={newCustomerData.address}
                onChange={e => setNewCustomerData({ ...newCustomerData, address: e.target.value })}
              />
              <input
                className="w-full p-3 border rounded-lg"
                placeholder="Teléfono"
                value={newCustomerData.phone}
                onChange={e => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setShowQuickCustomer(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={handleQuickCustomerCreate}
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Botón flotante para ver carrito (móvil) */}
      {mobileView === 'products' && cart.length > 0 && (
        <button
          onClick={() => setMobileView('cart')}
          className="md:hidden fixed bottom-6 right-6 bg-orange-600 text-white p-4 rounded-full shadow-lg flex items-center gap-2"
        >
          <ShoppingCart size={24} />
          <span className="font-bold">{formatPrice(totals.finalTotal)}</span>
        </button>
      )}
    </div>
  );
};

export default POS;