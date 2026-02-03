import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { logAction } from '../services/audit';
import {
    Percent, Plus, Trash2, Tag, Lock, Store,
    Flame, Gift, ArrowLeft, Calculator, ShoppingBag,
    ArrowRight, CheckCircle2, Pencil, Package
} from 'lucide-react';
import { PromotionSchema } from '../schemas/promotions';
import { z } from 'zod';

// Tipos para manejar el estado local
type PromoType = 'percent' | 'fixed' | '2x1';

interface PromoFormData {
    id?: string;
    name: string;
    product_1_id: string;
    product_2_id: string;
    value: number;
}

export default function Promotions() {
    // Estado de Datos
    const [promotions, setPromotions] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDemo, setIsDemo] = useState(false);

    // Estado de UI
    const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
    const [editingPromoId, setEditingPromoId] = useState<string | null>(null);

    // Estado del Constructor de Ofertas
    const [dealType, setDealType] = useState<PromoType>('percent');
    const [formData, setFormData] = useState<PromoFormData>({
        name: '',
        product_1_id: '',
        product_2_id: '',
        value: 0,
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const email = user?.email || '';

        // Cargar productos para el select (Solo activos)
        const { data: prodData } = await supabase.from('products').select('*').eq('active', true).is('deleted_at', null);
        if (prodData) setProducts(prodData);

        // MODO DEMO
        if (email.toLowerCase().includes('demo')) {
            setIsDemo(true);
            const demoProducts = prodData || [];
            setPromotions([
                { id: '1', name: 'Martes de Locos (Demo)', discount_percentage: 20, type: 'percent', product_1_id: demoProducts[0]?.id, product_2_id: null },
                { id: '2', name: 'Combo Burger (Demo)', discount_percentage: 15, type: 'fixed', fixed_price: 12000, product_1_id: demoProducts[1]?.id, product_2_id: demoProducts[2]?.id },
                { id: '3', name: '2x1 Cervezas (Demo)', discount_percentage: 50, type: '2x1', product_1_id: demoProducts[3]?.id, product_2_id: null }
            ]);
            setLoading(false);
            return;
        }

        // MODO REAL
        const { data } = await supabase
            .from('promotions')
            .select('*')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (data) setPromotions(data);
        setLoading(false);
    };

    // --- Obtener nombre de producto por ID ---
    const getProductName = (productId: string | null | undefined) => {
        if (!productId) return null;
        const product = products.find(p => p.id === productId);
        return product?.name || 'Producto no encontrado';
    };

    const getProductPrice = (productId: string | null | undefined) => {
        if (!productId) return 0;
        const product = products.find(p => p.id === productId);
        return product?.price || 0;
    };

    // --- CÁLCULOS EN TIEMPO REAL ---
    const previewData = useMemo(() => {
        const p1 = products.find(p => p.id === formData.product_1_id);
        const p2 = products.find(p => p.id === formData.product_2_id);

        let regularPrice = 0;
        let finalPrice = 0;
        let savings = 0;
        let calculatedPercent = 0;

        if (!p1 && !formData.product_1_id) return null;

        const price1 = p1 ? p1.price : 0;
        const price2 = p2 ? p2.price : 0;

        if (dealType === 'percent') {
            regularPrice = price1 + price2;
            const discountAmount = regularPrice * (formData.value / 100);
            finalPrice = regularPrice - discountAmount;
            savings = discountAmount;
            calculatedPercent = formData.value;
        }
        else if (dealType === 'fixed') {
            regularPrice = price1 + price2;
            finalPrice = formData.value > 0 ? formData.value : regularPrice;
            savings = regularPrice - finalPrice;
            calculatedPercent = regularPrice > 0 ? ((savings / regularPrice) * 100) : 0;
        }
        else if (dealType === '2x1') {
            regularPrice = price1 * 2;
            finalPrice = price1;
            savings = price1;
            calculatedPercent = 50;
        }

        return { regularPrice, finalPrice, savings, calculatedPercent, p1, p2 };
    }, [formData, products, dealType]);


    // --- HANDLERS ---

    const handleCreateClick = () => {
        setFormData({ name: '', product_1_id: '', product_2_id: '', value: 0 });
        setDealType('percent');
        setEditingPromoId(null);
        setView('create');
    };

    const handleEditClick = (promo: any) => {
        setFormData({
            id: promo.id,
            name: promo.name,
            product_1_id: promo.product_1_id || '',
            product_2_id: promo.product_2_id || '',
            value: promo.type === 'fixed' ? (promo.fixed_price || 0) : (promo.discount_percentage || 0),
        });
        setDealType(promo.type || 'percent');
        setEditingPromoId(promo.id);
        setView('edit');
    };

    const handleSavePromo = async () => {
        const validation = PromotionSchema.safeParse({ ...formData, type: dealType });
        if (!validation.success) {
            return alert("⚠️ " + validation.error.issues[0].message);
        }

        // Preparar datos
        const payload: any = {
            name: formData.name,
            product_1_id: formData.product_1_id,
            product_2_id: formData.product_2_id || null,
            type: dealType,
            discount_percentage: Math.round(previewData?.calculatedPercent || 0),
            fixed_price: dealType === 'fixed' ? formData.value : null,
            is_active: true
        };

        // LOGICA DEMO
        if (isDemo) {
            if (editingPromoId) {
                setPromotions(promotions.map(p => p.id === editingPromoId ? { ...p, ...payload } : p));
                logAction('EDITAR_PROMO', `(Simulado) ${formData.name}`, 'Promociones');
                alert("Promoción editada en MEMORIA (Modo Demo)");
            } else {
                const fakePromo = { id: Date.now().toString(), ...payload };
                setPromotions([fakePromo, ...promotions]);
                logAction('CREAR_PROMO', `(Simulado) ${formData.name}`, 'Promociones');
                alert("Promoción creada en MEMORIA (Modo Demo)");
            }
            setView('list');
            return;
        }

        // LOGICA REAL
        if (editingPromoId) {
            // Editar promoción existente
            const { error } = await supabase
                .from('promotions')
                .update(payload)
                .eq('id', editingPromoId);

            if (error) {
                alert("Error: " + error.message);
            } else {
                await logAction('EDITAR_PROMO', `Editada: ${formData.name}`, 'Promociones');
                fetchData();
                setView('list');
            }
        } else {
            // Crear nueva promoción
            const { error } = await supabase.from('promotions').insert([payload]);

            if (error) {
                alert("Error: " + error.message);
            } else {
                await logAction('CREAR_PROMO', `Nueva: ${formData.name}`, 'Promociones');
                fetchData();
                setView('list');
            }
        }
    };

    const handleDeletePromo = async (id: any, name: string) => {
        if (!confirm("¿Eliminar esta promoción?")) return;

        if (isDemo) {
            setPromotions(promotions.filter(p => p.id !== id));
            return;
        }

        const { error } = await supabase
            .from('promotions')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            alert("Error: " + error.message);
        } else {
            logAction('ELIMINAR_PROMO', `Borrada (Soft): ${name}`, 'Promociones');
            setPromotions(prevPromos => prevPromos.filter(p => p.id !== id));
        }
    };

    // Calcular el precio de venta de la promoción
    const getPromoFinalPrice = (promo: any) => {
        if (promo.type === 'fixed' && promo.fixed_price) {
            return promo.fixed_price;
        }

        const price1 = getProductPrice(promo.product_1_id);
        const price2 = getProductPrice(promo.product_2_id);

        if (promo.type === '2x1') {
            return price1; // Paga 1, lleva 2
        }

        const regularPrice = price1 + price2;
        return regularPrice - (regularPrice * (promo.discount_percentage / 100));
    };

    const getPromoRegularPrice = (promo: any) => {
        const price1 = getProductPrice(promo.product_1_id);
        const price2 = getProductPrice(promo.product_2_id);

        if (promo.type === '2x1') {
            return price1 * 2;
        }

        return price1 + price2;
    };

    // --- RENDERIZADO ---

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-96 text-gray-400 animate-pulse">
            <Percent size={48} className="mb-4 opacity-20" />
            <p>Cargando ofertas...</p>
        </div>
    );

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto overflow-y-auto h-full">

            {/* HEADER */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <Tag className="text-purple-600" size={32} />
                        {view === 'list' ? 'Gestor de Promociones' : view === 'edit' ? 'Editar Promoción' : 'Constructor de Ofertas'}
                    </h2>
                    <p className="text-gray-500 mt-1 text-sm">
                        {view === 'list' ? 'Administra tus campañas activas.' : 'Configura tu estrategia de venta.'}
                    </p>
                </div>

                {view === 'list' ? (
                    <button onClick={handleCreateClick} className="bg-gray-900 hover:bg-purple-600 text-white px-5 py-3 rounded-xl shadow-lg shadow-purple-200 flex items-center gap-2 transition-all font-bold">
                        <Plus size={20} /> Crear Oferta
                    </button>
                ) : (
                    <button onClick={() => setView('list')} className="text-gray-500 hover:bg-gray-100 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium">
                        <ArrowLeft size={20} /> Volver
                    </button>
                )}
            </div>

            {isDemo && (
                <div className="mb-6 bg-orange-50 text-orange-800 p-3 rounded-lg flex items-center gap-2 text-sm border border-orange-200 animate-in fade-in slide-in-from-top-2">
                    <Lock size={16} />
                    <span><strong>Modo Demo:</strong> Los cambios son temporales y no afectan la base de datos real.</span>
                </div>
            )}

            {/* VISTA: LISTA DE PROMOS */}
            {view === 'list' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
                    {promotions.length === 0 && (
                        <div className="col-span-full text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                            <Store size={48} className="mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-500 font-medium">No hay promociones activas.</p>
                            <button onClick={handleCreateClick} className="text-purple-600 font-bold mt-2 hover:underline">Crear la primera</button>
                        </div>
                    )}
                    {promotions.map(promo => (
                        <div key={promo.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group relative">
                            <div className={`h-2 w-full ${promo.type === 'fixed' ? 'bg-orange-500' :
                                promo.type === '2x1' ? 'bg-indigo-500' : 'bg-blue-500'
                                }`}></div>

                            <div className="p-6">
                                {/* Header con tipo y acciones */}
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${promo.type === 'fixed' ? 'bg-orange-100 text-orange-700' :
                                        promo.type === '2x1' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        {promo.type === 'fixed' ? 'Combo Precio Fijo' : promo.type === '2x1' ? 'Promo 2x1' : 'Descuento %'}
                                    </span>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => handleEditClick(promo)}
                                            className="text-gray-300 hover:text-blue-500 transition-colors p-1"
                                            title="Editar"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDeletePromo(promo.id, promo.name)}
                                            className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Nombre de la promoción */}
                                <h3 className="font-bold text-xl text-gray-800 mb-3">{promo.name}</h3>

                                {/* Productos incluidos */}
                                <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                        <Package size={12} /> Productos incluidos
                                    </p>
                                    <div className="space-y-1">
                                        {promo.product_1_id && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="w-5 h-5 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
                                                <span className="text-gray-700 font-medium truncate flex-1">
                                                    {getProductName(promo.product_1_id)}
                                                </span>
                                                <span className="text-gray-400 text-xs">
                                                    ${getProductPrice(promo.product_1_id).toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                        {promo.product_2_id && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="w-5 h-5 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
                                                <span className="text-gray-700 font-medium truncate flex-1">
                                                    {getProductName(promo.product_2_id)}
                                                </span>
                                                <span className="text-gray-400 text-xs">
                                                    ${getProductPrice(promo.product_2_id).toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                        {promo.type === '2x1' && !promo.product_2_id && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
                                                <span className="text-indigo-600 font-medium italic">
                                                    (Mismo producto gratis)
                                                </span>
                                            </div>
                                        )}
                                        {!promo.product_1_id && (
                                            <p className="text-gray-400 text-sm italic">Sin productos asignados</p>
                                        )}
                                    </div>
                                </div>

                                {/* Descuento y precio */}
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <CheckCircle2 size={16} className="text-green-500" />
                                    <span>{promo.discount_percentage}% OFF</span>
                                </div>

                                {/* Precios */}
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className="text-gray-400 text-xs line-through block">
                                                ${getPromoRegularPrice(promo).toLocaleString()}
                                            </span>
                                            <span className="text-2xl font-bold text-gray-900">
                                                ${Math.round(getPromoFinalPrice(promo)).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-xs font-bold">
                                            Ahorrás ${Math.round(getPromoRegularPrice(promo) - getPromoFinalPrice(promo)).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* VISTA: CONSTRUCTOR (BUILDER) / EDICIÓN */}
            {(view === 'create' || view === 'edit') && (
                <div className="flex flex-col lg:flex-row gap-8 animate-in slide-in-from-right-4 duration-500">

                    {/* IZQUIERDA: CONFIGURACIÓN */}
                    <div className="flex-1 space-y-8">

                        {/* PASO 1: TIPO DE OFERTA */}
                        <section>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">1. Elige la Estrategia</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <button
                                    onClick={() => { setDealType('percent'); setFormData({ ...formData, value: 0 }); }}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${dealType === 'percent' ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-100' : 'border-gray-200 hover:border-blue-200 bg-white'}`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${dealType === 'percent' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                        <Percent size={20} />
                                    </div>
                                    <div className="font-bold text-gray-800">Porcentaje</div>
                                    <div className="text-xs text-gray-500 mt-1">Descuento clásico (15% OFF) en uno o dos productos.</div>
                                </button>

                                <button
                                    onClick={() => { setDealType('fixed'); setFormData({ ...formData, value: 0 }); }}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${dealType === 'fixed' ? 'border-orange-500 bg-orange-50 ring-4 ring-orange-100' : 'border-gray-200 hover:border-orange-200 bg-white'}`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${dealType === 'fixed' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                        <Flame size={20} />
                                    </div>
                                    <div className="font-bold text-gray-800">Precio Fijo / Combo</div>
                                    <div className="text-xs text-gray-500 mt-1">Lleva X + Y por un precio cerrado único.</div>
                                </button>

                                <button
                                    onClick={() => { setDealType('2x1'); setFormData({ ...formData, value: 0 }); }}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${dealType === '2x1' ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100' : 'border-gray-200 hover:border-indigo-200 bg-white'}`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${dealType === '2x1' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                        <Gift size={20} />
                                    </div>
                                    <div className="font-bold text-gray-800">2x1 (Happy Hour)</div>
                                    <div className="text-xs text-gray-500 mt-1">Lleva 2, paga 1. Aplica al mismo producto.</div>
                                </button>
                            </div>
                        </section>

                        {/* PASO 2: PRODUCTOS Y VALORES */}
                        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">2. Configuración</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Comercial</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder={dealType === '2x1' ? "Ej: Jueves de 2x1 en Pintas" : dealType === 'fixed' ? "Ej: Combo Burgués" : "Ej: 15% OFF Socios"}
                                        className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Producto Principal</label>
                                        <div className="relative">
                                            <select
                                                className="w-full p-3 pl-10 border border-gray-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
                                                value={formData.product_1_id}
                                                onChange={e => setFormData({ ...formData, product_1_id: e.target.value })}
                                            >
                                                <option value="">Seleccionar...</option>
                                                {products.map(p => <option key={p.id} value={p.id}>{p.name} (${p.price.toLocaleString()})</option>)}
                                            </select>
                                            <ShoppingBag className="absolute left-3 top-3.5 text-gray-400" size={18} />
                                        </div>
                                    </div>

                                    {dealType !== '2x1' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Producto Secundario <span className="text-gray-400 font-normal">(Opcional)</span></label>
                                            <div className="relative">
                                                <select
                                                    className="w-full p-3 pl-10 border border-gray-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
                                                    value={formData.product_2_id}
                                                    onChange={e => setFormData({ ...formData, product_2_id: e.target.value })}
                                                >
                                                    <option value="">Ninguno</option>
                                                    {products.map(p => <option key={p.id} value={p.id}>{p.name} (${p.price.toLocaleString()})</option>)}
                                                </select>
                                                <Plus className="absolute left-3 top-3.5 text-gray-400" size={18} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* INPUT DE VALOR SEGÚN TIPO */}
                                {dealType === 'percent' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Porcentaje de Descuento</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                className="w-full p-3 pl-10 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg"
                                                placeholder="Ej: 20"
                                                min="1" max="100"
                                                value={formData.value || ''}
                                                onChange={e => setFormData({ ...formData, value: Number(e.target.value) })}
                                            />
                                            <Percent className="absolute left-3 top-4 text-gray-400" size={18} />
                                        </div>
                                    </div>
                                )}

                                {dealType === 'fixed' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Precio Final del Combo</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                className="w-full p-3 pl-10 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 font-bold text-lg"
                                                placeholder="Ej: 10000"
                                                value={formData.value || ''}
                                                onChange={e => setFormData({ ...formData, value: Number(e.target.value) })}
                                            />
                                            <span className="absolute left-4 top-3.5 text-gray-400 font-bold">$</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">El sistema calculará el % de descuento automáticamente.</p>
                                    </div>
                                )}

                                {dealType === '2x1' && (
                                    <div className="bg-indigo-50 text-indigo-800 p-4 rounded-lg flex gap-3 items-start">
                                        <Gift className="mt-1 flex-shrink-0" size={20} />
                                        <div>
                                            <p className="font-bold">Automático</p>
                                            <p className="text-sm">Se cobrará 1 unidad al llevar 2. Descuento efectivo: 50%.</p>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </section>
                    </div>

                    {/* DERECHA: PREVIEW EN TIEMPO REAL */}
                    <div className="w-full lg:w-96">
                        <div className="sticky top-6">
                            <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                                {/* Fondo Decorativo */}
                                <div className="absolute top-0 right-0 -mr-4 -mt-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                                <div className="absolute bottom-0 left-0 -ml-4 -mb-4 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl"></div>

                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                                    <Calculator size={16} /> Resumen
                                </h3>

                                {previewData && previewData.regularPrice > 0 ? (
                                    <div className="space-y-4 relative z-10">
                                        <div className="flex justify-between text-sm text-gray-400">
                                            <span>Precio Regular</span>
                                            <span className="line-through decoration-red-500 decoration-2">$ {previewData.regularPrice.toLocaleString()}</span>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <span className="font-medium text-gray-200">Precio Promo</span>
                                            <span className="text-3xl font-bold text-white tracking-tight">
                                                $ {Math.max(0, previewData.finalPrice).toLocaleString()}
                                            </span>
                                        </div>

                                        {previewData.savings > 0 && (
                                            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3 flex justify-between items-center mt-2">
                                                <span className="text-green-400 font-bold text-sm">Ahorras</span>
                                                <span className="text-green-400 font-bold text-lg">$ {previewData.savings.toLocaleString()}</span>
                                            </div>
                                        )}

                                        <div className="pt-4 border-t border-gray-700">
                                            <p className="text-xs text-gray-500 mb-2">Productos incluidos:</p>
                                            <ul className="text-xs space-y-1 text-gray-300">
                                                {previewData.p1 && <li>• {previewData.p1.name}</li>}
                                                {previewData.p2 && <li>• {previewData.p2.name}</li>}
                                                {dealType === '2x1' && <li className="text-indigo-400">• (x2 del mismo producto)</li>}
                                            </ul>
                                            <p className="text-xs text-gray-500 mt-3">
                                                Descuento real: <span className="text-purple-400 font-bold">{Math.round(previewData.calculatedPercent)}%</span>
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-10 text-center text-gray-500">
                                        <p>Selecciona productos para ver la simulación.</p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleSavePromo}
                                disabled={!formData.name || !formData.product_1_id}
                                className="w-full mt-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 group"
                            >
                                <span>{view === 'edit' ? 'Guardar Cambios' : 'Confirmar y Guardar'}</span>
                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}