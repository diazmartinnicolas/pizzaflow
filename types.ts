export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF'
}

export interface User {
  id: string;
  username: string;
  password: string; // In a real app, this would be hashed
  role: UserRole;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'pizza' | 'drink' | 'side' | 'dessert';
  image?: string;
  active: boolean;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  createdAt: number;
}

export interface Promotion {
  id: string;
  name: string;
  type: 'SIMPLE' | 'COMBO'; // SIMPLE = Discount on 1 product, COMBO = Buy A + B get discount
  targetProductIds: string[]; // For SIMPLE: [prodId], For COMBO: [prodId1, prodId2]
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  active: boolean;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  notes?: string;
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface Order {
  id: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: OrderStatus;
  createdBy: string; // User ID
  createdByName: string;
  createdAt: number; // Timestamp
  customerId?: string;
  customerName?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  userId: string;
  userName: string;
  timestamp: number;
}

export type ViewState = 'POS' | 'KITCHEN' | 'INVENTORY' | 'CUSTOMERS' | 'PROMOTIONS' | 'HISTORY' | 'USERS' | 'LOGIN';