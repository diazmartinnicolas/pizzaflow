import { z } from 'zod';

// Definimos las reglas para un Producto
export const ProductSchema = z.object({
  name: z.string()
    .min(3, "El nombre debe tener al menos 3 letras")
    .max(50, "El nombre es muy largo (máx 50 caracteres)"),

  price: z.number()
    .min(0, "El precio no puede ser negativo")
    .max(1000000, "Precio sospechosamente alto"),

  // Aquí estaba el error. Lo dejamos simple y funcional:
  category: z.enum([
    'Pizzas', 'Empanadas', 'Bebidas', 'Hamburguesas',
    'Mitades', 'Promociones', 'Milanesas', 'Ensaladas', 'Postres', 'Otros'
  ]),

  active: z.boolean().optional(),
});

// Esto nos permite usar el "Tipo" en TypeScript automáticamente
export type ProductInput = z.infer<typeof ProductSchema>;