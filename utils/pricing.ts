// src/utils/pricing.ts

/**
 * Calcula el precio final de una pizza mitad y mitad.
 * Regla de negocio: Se cobra el precio de la mitad más cara.
 */
export const calculateHalfHalfPrice = (half1Price: number, half2Price: number): number => {
    // Protección: Si los precios son negativos, devolvemos 0
    if (half1Price < 0 || half2Price < 0) return 0;
    
    return Math.max(half1Price, half2Price);
};