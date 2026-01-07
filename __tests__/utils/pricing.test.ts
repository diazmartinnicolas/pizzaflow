import { expect, test, describe } from 'vitest';
import { calculateHalfHalfPrice } from '../utils/pricing';

describe('Reglas de Precio - Pizza Mitad y Mitad', () => {

    // CASO 1: El escenario real que te preocupaba
    test('Debe cobrar el precio de la mitad más cara (Muzza vs JyM)', () => {
        const precioMuzza = 17000;
        const precioJamon = 22000;
        
        const total = calculateHalfHalfPrice(precioMuzza, precioJamon);
        
        // Esperamos que el resultado sea EXACTAMENTE 22.000
        expect(total).toBe(22000);
    });

    // CASO 2: Prueba inversa (para asegurar que el orden no importa)
    test('No importa el orden de selección', () => {
        expect(calculateHalfHalfPrice(22000, 17000)).toBe(22000);
    });

    // CASO 3: Seguridad anti-hackers (Precios negativos)
    test('Debe devolver 0 si alguien intenta inyectar precios negativos', () => {
        expect(calculateHalfHalfPrice(-5000, 10000)).toBe(0);
    });

    // CASO 4: Precios iguales
    test('Si valen lo mismo, cobra ese valor', () => {
        expect(calculateHalfHalfPrice(15000, 15000)).toBe(15000);
    });
});