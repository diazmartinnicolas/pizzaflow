# Fluxo - Contexto del Proyecto para Agentes de IA

## 1. Descripción del Negocio
Fluxo es un sistema POS (Punto de Venta) web para pizzerías, cerveceria, cafeteria.
El objetivo es agilizar la toma de pedidos, gestionar el inventario y controlar la caja.

## 2. Stack Tecnológico
- **Frontend:** React + Vite + TailwindCSS.
- **Backend:** Supabase (Base de datos y Auth).
- **Testing:** Vitest.
- **Validación:** Zod.

## 3. Lógica de Negocio Crítica (Donde enfocar los tests)

### A. Precios de Pizzas (Mitad y Mitad)
- Archivo: `utils/pricing.ts`
- Regla: Si se combinan dos mitades, se cobra el precio de la mitad más cara.
- Validaciones: No permite precios negativos.

### B. Inventario y Productos
- Archivo: `components/Inventory.tsx`
- Validaciones (Zod): `schemas/products.ts`
    - Precios no pueden ser negativos.
    - Categorías deben ser de la lista permitida.
    - Nombres min 3 caracteres.

### C. Carrito de Compras (POS)
- Los items se agregan al array del carrito.
- El total se calcula sumando precios unitarios * cantidad.
- Al confirmar venta, se debe descontar stock (futuro) y registrar transacción.

## 4. Estándares de Código
- Usar TypeScript estricto.
- No dejar `console.log` en producción.
- Usar Zod para validar cualquier input de usuario.