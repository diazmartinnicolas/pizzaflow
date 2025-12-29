import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Product, Order, AuditLog, UserRole, OrderStatus, Customer, Promotion } from '../types';

// Initial Data
const INITIAL_ADMIN: User = {
  id: 'admin-1',
  username: 'admin',
  password: '123',
  role: UserRole.ADMIN,
  name: 'Administrador'
};

// Prices updated to Argentine Pesos (approximate)
const INITIAL_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Pizza Muzza', description: 'Salsa de tomate, mucha mozzarella y orégano.', price: 12500, category: 'pizza', active: true },
  { id: 'p2', name: 'Pizza Calabresa', description: 'Mozzarella y rodajas de longaniza calabresa.', price: 14800, category: 'pizza', active: true },
  { id: 'p3', name: 'Coca Cola 1.5L', description: 'Refresco de cola botella grande.', price: 3500, category: 'drink', active: true },
  { id: 'p4', name: 'Empanada Carne', description: 'Empanada clásica de carne cortada a cuchillo.', price: 1200, category: 'side', active: true },
];

interface AppContextType {
  currentUser: User | null;
  users: User[];
  products: Product[];
  orders: Order[];
  customers: Customer[];
  promotions: Promotion[];
  logs: AuditLog[];
  login: (u: string, p: string) => boolean;
  logout: () => void;
  addProduct: (p: Product) => void;
  updateProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  addOrder: (o: Order) => void;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  addUser: (u: User) => void;
  updateUser: (u: User) => void;
  deleteUser: (id: string) => void;
  addCustomer: (c: Customer) => void;
  updateCustomer: (c: Customer) => void;
  addPromotion: (p: Promotion) => void;
  deletePromotion: (id: string) => void;
  togglePromotion: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load from LocalStorage or use defaults
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('users');
    return saved ? JSON.parse(saved) : [INITIAL_ADMIN];
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('orders');
    return saved ? JSON.parse(saved) : [];
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('customers');
    return saved ? JSON.parse(saved) : [];
  });

  const [promotions, setPromotions] = useState<Promotion[]>(() => {
    const saved = localStorage.getItem('promotions');
    return saved ? JSON.parse(saved) : [];
  });

  const [logs, setLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('logs');
    return saved ? JSON.parse(saved) : [];
  });

  // Persistence Effects
  useEffect(() => localStorage.setItem('users', JSON.stringify(users)), [users]);
  useEffect(() => localStorage.setItem('products', JSON.stringify(products)), [products]);
  useEffect(() => localStorage.setItem('orders', JSON.stringify(orders)), [orders]);
  useEffect(() => localStorage.setItem('customers', JSON.stringify(customers)), [customers]);
  useEffect(() => localStorage.setItem('promotions', JSON.stringify(promotions)), [promotions]);
  useEffect(() => localStorage.setItem('logs', JSON.stringify(logs)), [logs]);
  useEffect(() => {
    if (currentUser) localStorage.setItem('currentUser', JSON.stringify(currentUser));
    else localStorage.removeItem('currentUser');
  }, [currentUser]);

  // Logging Helper
  const addLog = (action: string, details: string) => {
    if (!currentUser) return;
    const newLog: AuditLog = {
      id: Date.now().toString(),
      action,
      details,
      userId: currentUser.id,
      userName: currentUser.name,
      timestamp: Date.now()
    };
    setLogs(prev => [newLog, ...prev]);
  };

  // Actions
  const login = (u: string, p: string) => {
    const found = users.find(user => user.username === u && user.password === p);
    if (found) {
      setCurrentUser(found);
      const loginLog: AuditLog = {
        id: Date.now().toString(),
        action: 'LOGIN',
        details: 'Usuario ingresó al sistema',
        userId: found.id,
        userName: found.name,
        timestamp: Date.now()
      };
      setLogs(prev => [loginLog, ...prev]);
      return true;
    }
    return false;
  };

  const logout = () => {
    addLog('LOGOUT', 'Usuario salió del sistema');
    setCurrentUser(null);
  };

  const addProduct = (p: Product) => {
    setProducts(prev => [...prev, p]);
    addLog('PRODUCT_ADD', `Agregó producto: ${p.name}`);
  };

  const updateProduct = (p: Product) => {
    setProducts(prev => prev.map(prod => prod.id === p.id ? p : prod));
    addLog('PRODUCT_UPDATE', `Actualizó producto: ${p.name}`);
  };

  const deleteProduct = (id: string) => {
    const prod = products.find(p => p.id === id);
    setProducts(prev => prev.filter(p => p.id !== id));
    addLog('PRODUCT_DELETE', `Eliminó producto: ${prod?.name || id}`);
  };

  const addOrder = (o: Order) => {
    setOrders(prev => [o, ...prev]);
    addLog('ORDER_CREATE', `Nueva orden #${o.id.slice(-4)} por $${o.total}`);
  };

  const updateOrderStatus = (id: string, status: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    addLog('ORDER_UPDATE', `Orden #${id.slice(-4)} estado: ${status}`);
  };

  const addUser = (u: User) => {
    setUsers(prev => [...prev, u]);
    addLog('USER_ADD', `Creó usuario: ${u.username}`);
  };

  const updateUser = (u: User) => {
    setUsers(prev => prev.map(user => user.id === u.id ? u : user));
    addLog('USER_UPDATE', `Actualizó usuario: ${u.username}`);
  };

  const deleteUser = (id: string) => {
    const user = users.find(u => u.id === id);
    setUsers(prev => prev.filter(u => u.id !== id));
    addLog('USER_DELETE', `Eliminó usuario: ${user?.username}`);
  };

  const addCustomer = (c: Customer) => {
    setCustomers(prev => [...prev, c]);
    addLog('CUSTOMER_ADD', `Registró cliente: ${c.firstName} ${c.lastName}`);
  };

  const updateCustomer = (c: Customer) => {
    setCustomers(prev => prev.map(cust => cust.id === c.id ? c : cust));
    addLog('CUSTOMER_UPDATE', `Actualizó cliente: ${c.firstName}`);
  };

  const addPromotion = (p: Promotion) => {
    setPromotions(prev => [...prev, p]);
    addLog('PROMO_ADD', `Creó promoción: ${p.name}`);
  };

  const deletePromotion = (id: string) => {
    setPromotions(prev => prev.filter(p => p.id !== id));
    addLog('PROMO_DELETE', `Eliminó promoción ID: ${id}`);
  };

  const togglePromotion = (id: string) => {
    setPromotions(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));
  };

  return (
    <AppContext.Provider value={{
      currentUser, users, products, orders, customers, promotions, logs,
      login, logout,
      addProduct, updateProduct, deleteProduct,
      addOrder, updateOrderStatus,
      addUser, updateUser, deleteUser,
      addCustomer, updateCustomer,
      addPromotion, deletePromotion, togglePromotion
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};