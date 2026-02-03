export interface User {
  id: string;
  email: string;
  role: string;
  full_name?: string;
  company_id?: string;
}

export interface Profile {
  id: string;
  email: string;
  role: string;
  full_name?: string;
  name?: string;
  company_id?: string;
  companies?: Company;
}

export interface Company {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  active: boolean;
  is_favorite?: boolean;
  stock?: number;
  company_id?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  is_active: boolean;
  company_id?: string;
}

export interface Promotion {
  id: string;
  name: string;
  type: string;
  discount_percentage: number;
  product_1_id: string;
  product_2_id?: string | null;
  fixed_price?: number | null;
  is_active: boolean;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price_at_moment: number;
}

export enum OrderStatus {
  PENDIENTE = 'pendiente',
  PREPARANDO = 'preparando',
  LISTO = 'listo',
  ENTREGADO = 'entregado',
  CANCELADO = 'cancelado'
}

export interface Order {
  id: string;
  ticket_number: number;
  total: number;
  status: string;
  payment_type: string;
  client_id: string;
  user_id: string;
  company_id: string;
  created_at: string;
  clients?: { name: string };
  order_items?: any[];
}