import React, { useState, useMemo, useCallback } from 'react';
import { ShoppingCart, Tag, Receipt } from 'lucide-react';
import { toast } from 'sonner';

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
import { CategoryTabs } from './molecules/CategoryTabs';

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

// ============================================================
// COMPONENTE PRINCIPAL: POS
// ============================================================

interface POSProps {
  isDemo?: boolean;
  onDemoOrder?: (order: any) => void;
}

const POS: React.FC<POSProps> = ({ isDemo = false, onDemoOrder }) => {
  // ----------------------------------------------------------
  // CONTEXTOS Y HOOKS
  // ----------------------------------------------------------

  const {
    products,
    customers,
    promotions,
    createOrder,
    toggleFavorite,
    session
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

  const handleCheckout = useCallback(async () => {
    if (cart.length === 0 || !customerSelector.selectedCustomerId) {
      toast.error("Selecciona un cliente y agrega productos");
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
          client: { name: customerSelector.searchTerm },
          order_items: cart.map(i => ({ product: { name: i.name }, quantity: 1 }))
        });

        clearCart();
        customerSelector.clearSelection();
        resetCheckout();
        setMobileView('products');
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

        return {
          product_id: productId,
          quantity: item.quantity,
          price_at_moment: item.price,
          item_name: itemName,
          notes: itemDescription
        };
      });

      await createOrder({
        client_id: customerSelector.selectedCustomerId,
        total: totals.finalTotal,
        payment_type: paymentMethod,
        user_id: session.user.id
      }, orderItems);

      clearCart();
      customerSelector.clearSelection();
      resetCheckout();
      setMobileView('products');
      toast.success("¡Pedido enviado con éxito!");
    } catch (err: any) {
      toast.error("Error al procesar pedido: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [
    cart, customerSelector, isDemo, onDemoOrder,
    createOrder, totals, paymentMethod, session,
    groupedCart, products, promotions, clearCart, resetCheckout, setIsProcessing
  ]);

  const handleQuickCustomerCreate = useCallback(async () => {
    if (!newCustomerData.name || newCustomerData.name.length < 3) {
      toast.error("El nombre debe tener al menos 3 caracteres");
      return;
    }

    try {
      // TODO: Conectar con createCustomer del contexto
      toast.info("Funcionalidad de crear cliente rápido pendiente");
      setShowQuickCustomer(false);
      setNewCustomerData({ name: '', address: '', phone: '' });
    } catch (error: any) {
      toast.error("Error creando cliente: " + error.message);
    }
  }, [newCustomerData]);

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
        <div className="p-6 border-t border-gray-100 bg-gray-50 space-y-4">
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

          {/* Botón Confirmar */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isProcessing}
            disabled={!customerSelector.selectedCustomerId || cart.length === 0}
            onClick={handleCheckout}
          >
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