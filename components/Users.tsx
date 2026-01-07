import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { 
  Building2, Pizza, Beer, UtensilsCrossed, Coffee, ShieldCheck,
  Plus, Search, Trash2, Pencil, X, 
  UserCog, AlertTriangle, ChefHat, CreditCard, User, Mail, Briefcase, Lock
} from 'lucide-react';

// Credenciales para crear usuarios nuevos (Auth)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// --- DATOS MOCK PARA MODO STAFF (DEMO) ---
const DEMO_STAFF = [
  { id: '1', name: 'Carlos "Caja" Ruiz', email: 'caja1@fluxo.com', role: 'cashier', status: 'active' },
  { id: '2', name: 'Marta Cocina', email: 'chef@fluxo.com', role: 'cocina', status: 'active' },
  { id: '3', name: 'Lucas Mozo', email: 'salon@fluxo.com', role: 'waiter', status: 'active' },
  { id: '4', name: 'Sofía Admin', email: 'sofia@fluxo.com', role: 'admin', status: 'active' },
];

export default function Users() {
  // ESTADOS
  const [viewMode, setViewMode] = useState<'companies' | 'staff'>('companies');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // DATOS DEL USUARIO ACTUAL
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);

  // --- ESTADOS DE MODALES ---
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // --- DATOS FORMULARIOS (UNIFICADO) ---
  const [formData, setFormData] = useState({
    name: '', // Nombre Fantasía (Empresa) o Nombre Completo (Staff)
    typeOrRole: '', // Rubro (Empresa) o Rol (Staff)
    email: '',
    password: ''
  });

  // Datos para edición
  const [editData, setEditData] = useState({
    id: '', 
    name: '', 
    typeOrRole: '', 
    status: '', 
    currentEmail: '', 
    newEmail: '' 
  });

  const [adminMap, setAdminMap] = useState<Record<string, string>>({});

  useEffect(() => {
    checkUserAndFetch();
  }, []);

  // --- LÓGICA CORE DE 3 VÍAS ---
  const checkUserAndFetch = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; 

    const email = user.email || '';

    // 1. MODO DEMO
    if (email.includes('demo')) {
        console.log("Modo: Demo Staff");
        setViewMode('staff');
        setItems(DEMO_STAFF);
        setLoading(false);
        return;
    }

    // 2. HARD CHECK: SUPER ADMIN (SaaS Manager)
    if (email === 'diazmartinnicolas@gmail.com' || user.user_metadata?.role === 'super_admin') {
        console.log("Modo: Super Admin (Companies)");
        setViewMode('companies');
        setFormData(prev => ({ ...prev, typeOrRole: 'pizzeria' })); 
        // Mock de perfil para evitar errores
        setCurrentUserProfile({ role: 'super_admin' });
        await fetchCompanies();
        setLoading(false);
        return;
    }

    // 3. MODO ADMIN DE NEGOCIO (Staff Manager)
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    
    setCurrentUserProfile(profile);
    console.log("Modo: Business Admin (Real Staff)");
    setViewMode('staff');
    setFormData(prev => ({ ...prev, typeOrRole: 'cashier' })); 
    
    if (profile?.company_id) {
        await fetchRealStaff(profile.company_id);
    } else {
        console.warn("Usuario sin company_id asignado.");
    }
    
    setLoading(false);
  };

  const fetchCompanies = async () => {
    try {
      const { data: coData, error: coError } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false }); // RLS debe filtrar deleted_at IS NULL

      if (coError) throw coError;

      const { data: profData } = await supabase
        .from('profiles')
        .select('company_id, email')
        .eq('role', 'admin')
        .not('company_id', 'is', null);

      if (coData) setItems(coData.map(c => ({...c, name: c.name || 'Sin Nombre'})));
      
      if (profData) {
        const mapping: Record<string, string> = {};
        profData.forEach((p: any) => { mapping[p.company_id] = p.email || 'Sin Email'; });
        setAdminMap(mapping);
      }
    } catch (error: any) {
      console.error("Error fetching companies:", error);
    }
  };

  const fetchRealStaff = async (companyId: string) => {
      try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('company_id', companyId)
            .neq('role', 'super_admin') 
            .order('name', { ascending: true }); // RLS debe filtrar deleted_at IS NULL

          if (error) throw error;
          if (data) setItems(data.map(s => ({
              ...s, 
              name: s.name || 'Sin Nombre',
              email: s.email || 'Sin Email'
          })));
      } catch (error: any) {
          console.error("Error fetching staff:", error);
      }
  };

  // --- CREACIÓN (Dual Logic) ---
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // DEMO
    if (items === DEMO_STAFF) {
        alert("(Demo) Ítem creado en memoria.");
        setShowCreateModal(false);
        return;
    }

    if (formData.password.length < 6) return alert("La contraseña debe tener al menos 6 caracteres.");
    setIsProcessing(true);

    try {
        const tempClient = createClient(supabaseUrl, supabaseKey);

        if (viewMode === 'companies') {
            // A) CREAR EMPRESA + ADMIN
            const { data: company, error: coError } = await supabase
                .from('companies')
                .insert([{ name: formData.name, business_type: formData.typeOrRole, status: 'active' }])
                .select().single();

            if (coError) throw coError;

            // Trigger SQL se encarga del perfil
            const { error: authError } = await tempClient.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: `Admin ${formData.name}`,
                        role: 'admin',
                        company_id: company.id 
                    }
                }
            });
            if (authError) throw authError;
            alert(`✅ Empresa "${formData.name}" creada.`);
            await fetchCompanies();

        } else {
            // B) CREAR EMPLEADO (STAFF)
            const myCompanyId = currentUserProfile?.company_id;
            if (!myCompanyId) throw new Error("No tienes una empresa asignada.");

            const { error: authError } = await tempClient.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.name, // Nombre empleado
                        role: formData.typeOrRole, // Rol empleado
                        company_id: myCompanyId
                    }
                }
            });
            if (authError) throw authError;
            alert(`✅ Empleado "${formData.name}" registrado.`);
            await fetchRealStaff(myCompanyId);
        }

        setShowCreateModal(false);
        // Reset form
        setFormData({ 
            name: '', 
            typeOrRole: viewMode === 'companies' ? 'pizzeria' : 'cashier', 
            email: '', 
            password: '' 
        });

    } catch (error: any) {
        alert("Error: " + error.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // --- EDICIÓN ---
  const handleEditSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsProcessing(true);

      try {
          if (viewMode === 'companies') {
              // Editar Empresa
              const { error } = await supabase.from('companies').update({
                  name: editData.name,
                  business_type: editData.typeOrRole,
                  status: editData.status
              }).eq('id', editData.id);
              if (error) throw error;

              // Reasignar Admin
              if (editData.newEmail.trim() !== '') {
                  const { error: rpcError } = await supabase.rpc('assign_company_admin', {
                      p_email: editData.newEmail.trim(),
                      p_company_id: editData.id
                  });
                  if (rpcError) throw rpcError;
              }
              await fetchCompanies();
          } else {
              // Editar Empleado (Perfil)
              if (currentUserProfile) {
                  const { error } = await supabase.from('profiles').update({
                      name: editData.name,
                      role: editData.typeOrRole
                  }).eq('id', editData.id);
                  if (error) throw error;
                  await fetchRealStaff(currentUserProfile.company_id);
              }
          }
          alert("✅ Actualizado.");
          setShowEditModal(false);
      } catch (error: any) {
          alert("Error: " + error.message);
      } finally {
          setIsProcessing(false);
      }
  };

  // --- BORRAR (SOFT DELETE IMPLEMENTADO) ---
  const handleDelete = async (id: string, name: string) => {
      if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
      
      if (items === DEMO_STAFF) {
          setItems(prev => prev.filter(i => i.id !== id));
          return;
      }

      try {
          if (viewMode === 'companies') {
              // SOFT DELETE EMPRESAS
              const { error } = await supabase
                .from('companies')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);

              if (error) throw error;
              await fetchCompanies();
          } else {
              // SOFT DELETE STAFF
              // Eliminada la llamada a rpc('delete_user_by_admin') para preservar el usuario Auth
              // Solo marcamos el perfil como borrado
              const { error } = await supabase
                .from('profiles')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);

              if (error) throw error;
              
              if (currentUserProfile) await fetchRealStaff(currentUserProfile.company_id);
          }
      } catch (error: any) {
          alert("Error al borrar: " + error.message);
      }
  };

  // --- PREPARAR MODAL DE EDICIÓN ---
  const openEditModal = (item: any) => {
      if (items === DEMO_STAFF) {
          alert("Edición simulada en modo Demo.");
          return;
      }

      setEditData({
          id: item.id,
          name: item.name || '',
          typeOrRole: viewMode === 'companies' ? item.business_type : item.role,
          status: item.status || 'active',
          currentEmail: viewMode === 'companies' ? (adminMap[item.id] || '') : (item.email || ''),
          newEmail: ''
      });
      setShowEditModal(true);
  };

  // --- HELPERS VISUALES ---
  const getBusinessVisuals = (type: string) => {
      const t = (type || '').toLowerCase();
      switch (t) {
          case 'pizzeria': return { icon: <Pizza size={20} className="text-orange-600" />, bg: 'bg-orange-100', label: 'Pizzería' };
          case 'cerveceria': return { icon: <Beer size={20} className="text-yellow-600" />, bg: 'bg-yellow-100', label: 'Cervecería' };
          case 'restaurante': return { icon: <UtensilsCrossed size={20} className="text-blue-600" />, bg: 'bg-blue-100', label: 'Restaurante' };
          case 'cafeteria': return { icon: <Coffee size={20} className="text-amber-800" />, bg: 'bg-amber-100', label: 'Cafetería' };
          default: return { icon: <Building2 size={20} className="text-gray-500" />, bg: 'bg-gray-100', label: t || 'Empresa' };
      }
  };

  const getStaffVisuals = (role: string) => {
      const r = (role || '').toLowerCase();
      switch (r) {
          case 'admin': return { icon: <ShieldCheck size={20} className="text-purple-600" />, bg: 'bg-purple-100', label: 'Administrador' };
          case 'cashier': 
          case 'cajero': return { icon: <CreditCard size={20} className="text-green-600" />, bg: 'bg-green-100', label: 'Cajero' };
          case 'cocina': return { icon: <ChefHat size={20} className="text-orange-600" />, bg: 'bg-orange-100', label: 'Cocina' };
          case 'waiter':
          case 'mozo': return { icon: <User size={20} className="text-blue-600" />, bg: 'bg-blue-100', label: 'Camarero' };
          default: return { icon: <Briefcase size={20} className="text-gray-500" />, bg: 'bg-gray-100', label: r || 'Empleado' };
      }
  };

  const filtered = items.filter(i => (i.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return <div className="p-10 text-center animate-pulse text-gray-500">Cargando datos...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      {/* HEADER DINÁMICO */}
      <div className="flex justify-between items-center mb-6">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                {viewMode === 'companies' ? <ShieldCheck className="text-purple-600"/> : <UserCog className="text-blue-600"/>} 
                {viewMode === 'companies' ? 'Usuarios / Negocios' : 'Personal del Negocio'}
            </h2>
            <p className="text-sm text-gray-500">
                {viewMode === 'companies' ? 'Administración global de empresas SaaS.' : 'Gestión de empleados y roles.'}
            </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className={`${viewMode === 'companies' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-md transition-all`}>
            <Plus size={20} /> {viewMode === 'companies' ? 'Nuevo Cliente' : 'Nuevo Empleado'}
        </button>
      </div>

      {/* SEARCH */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 mb-6 flex items-center gap-2 shadow-sm">
        <Search className="text-gray-400" size={20}/>
        <input type="text" placeholder={viewMode === 'companies' ? "Buscar empresa..." : "Buscar empleado..."} className="flex-1 outline-none text-gray-700" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                <tr>
                    <th className="p-4">{viewMode === 'companies' ? 'Negocio' : 'Nombre'}</th>
                    <th className="p-4">{viewMode === 'companies' ? 'Admin Email' : 'Contacto'}</th>
                    {viewMode === 'companies' && <th className="p-4 text-center">Estado</th>}
                    <th className="p-4 text-right">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => {
                    const visuals = viewMode === 'companies' 
                        ? getBusinessVisuals(item.business_type)
                        : getStaffVisuals(item.role);
                    
                    const secondaryText = viewMode === 'companies' 
                        ? adminMap[item.id] 
                        : item.email;

                    return (
                        <tr key={item.id} className="hover:bg-gray-50">
                            <td className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl ${visuals.bg}`}>
                                        {visuals.icon}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800">{item.name}</p>
                                        <p className="text-xs text-gray-400 capitalize">{visuals.label}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="p-4 text-sm text-gray-600 font-medium">
                                {secondaryText ? 
                                    <span className="flex items-center gap-1">
                                        {viewMode === 'companies' ? <UserCog size={14} className="text-purple-500"/> : <Mail size={14} className="text-gray-400"/>} 
                                        {secondaryText}
                                    </span> 
                                    : <span className="text-gray-300 italic">Sin dato</span>
                                }
                            </td>
                            
                            {viewMode === 'companies' && (
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>{item.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                                </td>
                            )}

                            <td className="p-4 text-right">
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => openEditModal(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Editar"><Pencil size={18} /></button>
                                    <button onClick={() => handleDelete(item.id, item.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Eliminar"><Trash2 size={18} /></button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>

    {/* MODAL CREAR (Unificado) */}
    {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-gray-800">{viewMode === 'companies' ? 'Nueva Empresa' : 'Nuevo Empleado'}</h3>
                    <button onClick={() => setShowCreateModal(false)}><X/></button>
                </div>
                <form onSubmit={handleCreate} className="space-y-4">
                    <input required placeholder={viewMode === 'companies' ? "Nombre Fantasía" : "Nombre Completo"} className="w-full p-2 border rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    
                    <select className="w-full p-2 border rounded bg-white" value={formData.typeOrRole} onChange={e => setFormData({...formData, typeOrRole: e.target.value})}>
                        {viewMode === 'companies' ? (
                            <>
                                <option value="pizzeria">🍕 Pizzería</option>
                                <option value="cerveceria">🍺 Cervecería</option>
                                <option value="restaurante">🍽️ Restaurante</option>
                                <option value="cafeteria">☕ Cafetería</option>
                            </>
                        ) : (
                            <>
                                <option value="cashier">💰 Cajero</option>
                                <option value="cocina">👨‍🍳 Cocina</option>
                                <option value="admin">🛡️ Admin</option>
                                <option value="waiter">💁 Mozo</option>
                            </>
                        )}
                    </select>
                    
                    <input required type="email" placeholder={viewMode === 'companies' ? "Email Admin" : "Email Empleado"} className="w-full p-2 border rounded" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    <input required type="password" placeholder="Contraseña" className="w-full p-2 border rounded" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                    
                    <button type="submit" disabled={isProcessing} className={`w-full ${viewMode === 'companies' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold py-3 rounded`}>
                        {isProcessing ? 'Creando...' : 'Registrar'}
                    </button>
                </form>
            </div>
        </div>
    )}

    {/* MODAL EDITAR (Adaptativo) */}
    {showEditModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-gray-900 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold flex items-center gap-2"><Pencil size={18}/> Editar</h3>
                    <button onClick={() => setShowEditModal(false)}><X/></button>
                </div>
                
                <form onSubmit={handleEditSave} className="p-6 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Nombre</label>
                        <input className="w-full p-2 border rounded" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                    </div>
                    
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">{viewMode === 'companies' ? 'Rubro' : 'Rol'}</label>
                        <select className="w-full p-2 border rounded bg-white" value={editData.typeOrRole} onChange={e => setEditData({...editData, typeOrRole: e.target.value})}>
                            {viewMode === 'companies' ? (
                                <>
                                    <option value="pizzeria">Pizzería</option>
                                    <option value="cerveceria">Cervecería</option>
                                    <option value="restaurante">Restaurante</option>
                                    <option value="cafeteria">Cafetería</option>
                                </>
                            ) : (
                                <>
                                    <option value="cashier">Cajero</option>
                                    <option value="cocina">Cocina</option>
                                    <option value="admin">Admin</option>
                                    <option value="waiter">Mozo</option>
                                </>
                            )}
                        </select>
                    </div>

                    {viewMode === 'companies' && (
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Estado</label>
                            <div className="flex items-center gap-2 mt-2">
                                <button type="button" onClick={() => setEditData({...editData, status: editData.status === 'active' ? 'inactive' : 'active'})} 
                                    className={`flex-1 font-bold text-xs py-1.5 rounded transition-colors ${editData.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                    {editData.status === 'active' ? 'ACTIVO' : 'INACTIVO'}
                                </button>
                            </div>
                        </div>
                    )}

                    {viewMode === 'companies' && (
                        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mt-2">
                            <label className="text-xs font-bold text-yellow-800 uppercase flex items-center gap-1 mb-1"><UserCog size={14}/> Reasignar Admin</label>
                            <p className="text-xs text-gray-600 mb-2">Actual: <strong>{editData.currentEmail}</strong></p>
                            <input type="email" placeholder="Nuevo Email" className="w-full p-2 border border-yellow-300 rounded text-sm" value={editData.newEmail} onChange={e => setEditData({...editData, newEmail: e.target.value})} />
                        </div>
                    )}

                    <button type="submit" disabled={isProcessing} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 shadow-md mt-2">
                        {isProcessing ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </form>
            </div>
        </div>
    )}
    </div>
  );
}