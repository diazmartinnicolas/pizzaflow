import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Product, OrderItem, Order, OrderStatus, Customer } from '../types';
import { 
  Plus, Minus, Trash2, Receipt, ShoppingCart, 
  User as UserIcon, X, Tag, Banknote, QrCode, CreditCard 
} from 'lucide-react';
// Importamos el botón
import { WhatsAppButton } from './WhatsAppButton';

const POS: React.FC = () => {
  const { products, addOrder, currentUser, customers, addCustomer, promotions } = useApp();
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // ESTADO PARA EL TIPO DE PAGO
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash');

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ firstName: '', lastName: '', phone: '', address: '' });

  const categories = [
    { id: 'all', label: 'Todo' },
    { id: 'pizza', label: 'Pizzas' },
    { id: 'side', label: 'Acompañantes' },
    { id: 'drink', label: 'Bebidas' },
    { id: 'dessert', label: 'Postres' },
  ];

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);
  };

  const filteredProducts = useMemo(() => {
    return selectedCategory === 'all' 
      ? products.filter(p => p.active)
      : products.filter(p => p.active && p.category === selectedCategory);
  }, [products, selectedCategory]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { productId: product.id, productName: product.name, price: product.price, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  // Totales y Descuentos
  const { subtotal, discount, total, appliedPromos } = useMemo(() => {
    let subtotal = 0;
    cart.forEach(item => subtotal += item.price * item.quantity);
    
    let totalDiscount = 0;
    const activePromos = promotions.filter(p => p.active);
    const appliedPromos: string[] = [];

    // Descuentos Simples
    activePromos.filter(p => p.type === 'SIMPLE').forEach(promo => {
        const targetId = promo.targetProductIds[0];
        const cartItem = cart.find(i => i.productId === targetId);
        if (cartItem) {
            let itemDiscount = 0;
            if (promo.discountType === 'PERCENTAGE') {
                itemDiscount = (cartItem.price * (promo.discountValue / 100)) * cartItem.quantity;
            } else {
                itemDiscount = promo.discountValue * cartItem.quantity;
            }
            totalDiscount += itemDiscount;
            appliedPromos.push(promo.name);
        }
    });

    // Descuentos Combo
    activePromos.filter(p => p.type === 'COMBO').forEach(promo => {
        const requiredIds = promo.targetProductIds;
        const possibleSets = requiredIds.map(reqId => {
            const item = cart.find(i => i.productId === reqId);
            return item ? item.quantity : 0;
        });
        const setsCount = Math.min(...possibleSets);

        if (setsCount > 0) {
            let comboDiscount = 0;
            let comboBasePrice = 0;
            requiredIds.forEach(id => {
                const item = cart.find(i => i.productId === id);
                if(item) comboBasePrice += item.price;
            });

            if (promo.discountType === 'PERCENTAGE') {
                comboDiscount = (comboBasePrice * (promo.discountValue / 100)) * setsCount;
            } else {
                comboDiscount = promo.discountValue * setsCount;
            }
            totalDiscount += comboDiscount;
            appliedPromos.push(`${promo.name} (x${setsCount})`);
        }
    });

    const finalTotal = Math.max(0, subtotal - totalDiscount);
    return { subtotal, discount: totalDiscount, total: finalTotal, appliedPromos };
  }, [cart, promotions]);

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerData.firstName) return;
    const newC: Customer = {
      ...newCustomerData,
      id: Date.now().toString(),
      createdAt: Date.now()
    };
    addCustomer(newC);
    setSelectedCustomer(newC);
    setIsCustomerModalOpen(false);
    setNewCustomerData({ firstName: '', lastName: '', phone: '', address: '' });
  };

  const handleCheckout = () => {
    if (cart.length === 0 || !currentUser) return;

    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      items: [...cart],
      subtotal,
      discount,
      total,
      status: OrderStatus.PENDING,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      createdAt: Date.now(),
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}` : 'Consumidor Final',
      // Si tu base de datos guarda el método de pago, descomenta la siguiente línea:
      // payment_type: paymentMethod 
    };

    addOrder(newOrder);
    setLastOrder(newOrder);
    setCart([]);
  };

  const handleCloseModal = () => {
    setLastOrder(null);
    setSelectedCustomer(null); 
    setPaymentMethod('cash');
  };

  return (
    <div className="flex h-full flex-col md:flex-row gap-4 p-4 overflow-hidden">
      {/* Product Grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors text-sm font-medium ${
                selectedCategory === cat.id 
                  ? 'bg-orange-600 text-white shadow-md' 
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pr-2 pb-20 md:pb-0">
          {filteredProducts.map(product => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-orange-300 hover:shadow-md transition-all text-left flex flex-col justify-between group h-48"
            >
              <div>
                <h3 className="font-bold text-gray-800 group-hover:text-orange-600">{product.name}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
              </div>
              <div className="flex justify-between items-end mt-4">
                <span className="font-bold text-lg text-gray-900">{formatPrice(product.price)}</span>
                <div className="bg-orange-100 text-orange-600 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus size={16} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-full md:w-96 bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col h-[40vh] md:h-full">
        {/* Customer Selector */}
        <div className="p-3 bg-gray-50 border-b border-gray-200">
           {selectedCustomer ? (
             <div className="flex justify-between items-center bg-white border border-green-200 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <UserIcon size={16} className="text-green-600" />
                  <div>
                    <p className="text-sm font-bold text-gray-800">{selectedCustomer.firstName} {selectedCustomer.lastName}</p>
                    <p className="text-xs text-gray-500">{selectedCustomer.address}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="text-gray-400 hover:text-red-500"><X size={16}/></button>
             </div>
           ) : (
             <div className="flex gap-2">
                <select 
                  className="flex-1 text-sm border-gray-300 rounded-lg p-2 border outline-none focus:ring-2 focus:ring-orange-200"
                  onChange={(e) => {
                      const c = customers.find(cus => cus.id === e.target.value);
                      if(c) setSelectedCustomer(c);
                  }}
                  value=""
                >
                  <option value="" disabled>Seleccionar Cliente...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                  ))}
                </select>
                <button 
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="bg-gray-200 hover:bg-gray-300 p-2 rounded-lg text-gray-700 transition-colors"
                  title="Nuevo Cliente"
                >
                  <Plus size={18} />
                </button>
             </div>
           )}
        </div>

        <div className="p-4 border-b border-gray-100 bg-white">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ShoppingCart size={20} className="text-orange-500" />
            Orden Actual
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
              <p>El carrito está vacío</p>
              <p className="text-xs mt-2">Selecciona productos para comenzar</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.productId} className="flex justify-between items-center group">
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{item.productName}</p>
                  <p className="text-xs text-gray-500">{formatPrice(item.price)} c/u</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                    <button onClick={() => updateQuantity(item.productId, -1)} className="p-1 hover:bg-white rounded shadow-sm"><Minus size={12} /></button>
                    <span className="text-sm font-semibold w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.productId, 1)} className="p-1 hover:bg-white rounded shadow-sm"><Plus size={12} /></button>
                  </div>
                  <button onClick={() => removeFromCart(item.productId)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Discounts Section */}
        {appliedPromos.length > 0 && (
          <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-100">
            <p className="text-xs font-bold text-yellow-700 mb-1 flex items-center gap-1">
              <Tag size={12} /> Promociones Aplicadas:
            </p>
            {appliedPromos.map((p, i) => (
              <p key={i} className="text-xs text-yellow-600 ml-4">• {p}</p>
            ))}
          </div>
        )}

        <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl space-y-3">
          
          {/* BOTONES DE PAGO */}
          <div className="grid grid-cols-3 gap-2">
            <button 
              onClick={() => setPaymentMethod('cash')}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                paymentMethod === 'cash' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Banknote size={20} />
              <span className="text-[10px] font-bold mt-1 uppercase">Efectivo</span>
            </button>
            <button 
              onClick={() => setPaymentMethod('transfer')}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                paymentMethod === 'transfer' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <QrCode size={20} />
              <span className="text-[10px] font-bold mt-1 uppercase">Transf.</span>
            </button>
            <button 
              onClick={() => setPaymentMethod('card')}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                paymentMethod === 'card' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <CreditCard size={20} />
              <span className="text-[10px] font-bold mt-1 uppercase">Tarjeta</span>
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center text-sm text-gray-500">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
            </div>
            {discount > 0 && (
                <div className="flex justify-between items-center text-sm text-green-600 font-medium">
                <span>Descuento</span>
                <span>- {formatPrice(discount)}</span>
                </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-gray-900 font-bold text-lg">Total</span>
                <span className="text-2xl font-bold text-orange-600">{formatPrice(total)}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-all ${
              cart.length === 0 
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-orange-600 hover:bg-orange-700 shadow-lg hover:shadow-orange-200'
            }`}
          >
            Confirmar Pedido
          </button>
        </div>
      </div>

      {/* New Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-lg mb-4">Registro Rápido de Cliente</h3>
            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <input 
                placeholder="Nombre" 
                className="w-full border p-2 rounded" 
                value={newCustomerData.firstName} 
                onChange={e => setNewCustomerData({...newCustomerData, firstName: e.target.value})} 
              />
              <input 
                placeholder="Apellido" 
                className="w-full border p-2 rounded" 
                value={newCustomerData.lastName} 
                onChange={e => setNewCustomerData({...newCustomerData, lastName: e.target.value})} 
              />
              <input 
                placeholder="Teléfono (Ej: 261...)" 
                className="w-full border p-2 rounded" 
                value={newCustomerData.phone} 
                onChange={e => setNewCustomerData({...newCustomerData, phone: e.target.value})} 
              />
              <input 
                placeholder="Dirección" 
                className="w-full border p-2 rounded" 
                value={newCustomerData.address} 
                onChange={e => setNewCustomerData({...newCustomerData, address: e.target.value})} 
              />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="flex-1 bg-gray-200 py-2 rounded">Cancelar</button>
                <button type="submit" className="flex-1 bg-orange-600 text-white py-2 rounded">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TICKET DE VENTA (AQUÍ APARECE EL BOTÓN DE WHATSAPP) */}
      {lastOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-sm shadow-2xl relative animate-in fade-in zoom-in duration-300">
            <div className="text-center mb-6 border-b border-dashed border-gray-300 pb-4">
              <h2 className="text-xl font-bold uppercase tracking-wider">Fluxo</h2>
              <p className="text-xs text-gray-500">Ticket de Venta</p>
              <p className="text-sm font-mono mt-2">Orden #{lastOrder.id.slice(-6)}</p>
              <p className="text-xs text-gray-400">{new Date(lastOrder.createdAt).toLocaleString()}</p>
              {lastOrder.customerName && <p className="text-xs text-gray-600 mt-1">Cliente: {lastOrder.customerName}</p>}
            </div>
            
            <div className="space-y-2 mb-6 font-mono text-sm">
              {lastOrder.items.map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{item.quantity}x {item.productName}</span>
                  <span>{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-300 pt-4 text-sm">
               <div className="flex justify-between text-gray-500">
                 <span>Subtotal</span>
                 <span>{formatPrice(lastOrder.subtotal)}</span>
               </div>
               {lastOrder.discount > 0 && (
                 <div className="flex justify-between text-gray-500">
                   <span>Descuento</span>
                   <span>-{formatPrice(lastOrder.discount)}</span>
                 </div>
               )}
               <div className="flex justify-between font-bold text-lg mt-2">
                 <span>Total</span>
                 <span>{formatPrice(lastOrder.total)}</span>
               </div>
               
               <div className="text-center mt-2 text-xs bg-gray-100 p-1 rounded font-bold uppercase">
                   PAGO: {paymentMethod === 'cash' ? 'EFECTIVO' : paymentMethod === 'transfer' ? 'TRANSFERENCIA' : 'TARJETA'}
               </div>
            </div>
            
            <div className="flex flex-col gap-2 mt-6">
              
              {/* BOTÓN WHATSAPP DE CONFIRMACIÓN */}
              <div className="w-full">
                  <WhatsAppButton 
                    className="w-full" /* 👈 ¡AQUÍ ESTÁ EL ARREGLO! (Se estirará al 100%) */
                    type="CONFIRMED"
                    order={{
                        id: lastOrder.id.slice(-6),
                        customerName: lastOrder.customerName,
                        phone: selectedCustomer?.phone || '',
                        total: lastOrder.total,
                        paymentMethod: paymentMethod, 
                        items: lastOrder.items.map(i => ({ quantity: i.quantity, name: i.productName }))
                    }}
                  />
                  {!selectedCustomer && (
                    <p className="text-[10px] text-red-500 text-center mt-1">
                        * Sin cliente seleccionado no se envía mensaje
                    </p>
                  )}
              </div>

              <button 
                onClick={() => window.print()} 
                className="w-full bg-gray-900 text-white py-2 rounded flex items-center justify-center gap-2 hover:bg-gray-800"
              >
                <Receipt size={16} /> Imprimir Ticket
              </button>
              
              <button 
                onClick={handleCloseModal} 
                className="w-full bg-orange-100 text-orange-700 py-2 rounded hover:bg-orange-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;