import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { 
  Building2, Store, Coffee, Beer, Utensils, 
  Plus, Search, Trash2, Edit, Save, X, 
  ToggleLeft, ToggleRight, CheckCircle, ShieldCheck, UserCog, AlertTriangle
} from 'lucide-react';

// Credenciales para crear usuarios nuevos (Auth)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function SaaS_Dashboard() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // --- ESTADOS DE MODALES ---
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // --- DATOS FORMULARIOS ---
  // Formulario Creación
  const [createData, setCreateData] = useState({
    businessName: '', businessType: 'pizzeria', adminEmail: '', adminPassword: ''
  });

  // Formulario Edición
  const [editData, setEditData] = useState({
    id: '', name: '', business_type: '', status: '', currentAdminEmail: '', newAdminEmail: ''
  });

  // Mapa de Admins: { company_id: email }
  const [adminMap, setAdminMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Cargar Empresas
      const { data: coData, error: coError } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (coError) throw coError;

      // 2. Cargar Admins vinculados
      const { data: profData } = await supabase
        .from('profiles')
        .select('company_id, email')
        .eq('role', 'admin')
        .not('company_id', 'is', null);

      if (coData) setCompanies(coData);
      
      // Mapear admins
      if (profData) {
        const mapping: Record<string, string> = {};
        profData.forEach((p: any) => { mapping[p.company_id] = p.email; });
        setAdminMap(mapping);
      }
    } catch (error: any) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- CREAR CLIENTE (Lógica original) ---
// --- CREAR CLIENTE (CORREGIDO) ---
const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validación básica
    if (createData.adminPassword.length < 6) return alert("La contraseña debe tener al menos 6 caracteres.");
    
    setIsProcessing(true);

    try {
      console.log("1. Iniciando creación de empresa:", createData.businessName);

      // 1. Insertar la Empresa
      const { data: company, error: coError } = await supabase
        .from('companies')
        .insert([{ 
            name: createData.businessName, 
            business_type: createData.businessType, 
            status: 'active' 
        }])
        .select()
        .single();

      if (coError) throw new Error(`Error creando empresa: ${coError.message}`);
      
      // LOG CRÍTICO PARA DEBUG
      console.log("2. Empresa creada correctamente:", company);

      // VALIDACIÓN ESTRICTA
      if (!company || !company.id) {
        throw new Error("La empresa se creó pero no devolvió un ID válido. Abortando creación de usuario.");
      }

      // 2. Crear el Usuario en Auth
      console.log("3. Creando usuario Auth vinculado a Company ID:", company.id);

      const tempClient = createClient(supabaseUrl, supabaseKey);
      
      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email: createData.adminEmail,
        password: createData.adminPassword,
        options: {
            data: {
                // Metadatos que leerá el Trigger
                full_name: `Admin ${createData.businessName}`,
                role: 'admin',
                company_id: company.id // ¡Aquí enviamos el UUID!
            }
        }
      });

      if (authError) throw new Error(`Error en Auth: ${authError.message}`);
      
      console.log("4. Usuario creado. El trigger debería haber generado el perfil.");

      alert(`✅ Cliente "${createData.businessName}" creado y vinculado exitosamente.`);
      setShowCreateModal(false);
      setCreateData({ businessName: '', businessType: 'pizzeria', adminEmail: '', adminPassword: '' });
      fetchData();

    } catch (error: any) {
      console.error("❌ Error Crítico:", error);
      alert("Fallo en el proceso: " + error.message);
      
      // Opcional: Aquí podrías agregar lógica para borrar la empresa si falló el usuario
      // if (company?.id) await supabase.from('companies').delete().eq('id', company.id);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- ABRIR EDICIÓN ---
  const openEditModal = (company: any) => {
      setEditData({
          id: company.id,
          name: company.name,
          business_type: company.business_type,
          status: company.status,
          currentAdminEmail: adminMap[company.id] || 'Sin asignar',
          newAdminEmail: '' // Limpio para que el usuario escriba si quiere cambiarlo
      });
      setShowEditModal(true);
  };

  // --- GUARDAR EDICIÓN (RPC INCLUIDA) ---
  const handleSaveEdit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsProcessing(true);

      try {
          // 1. Actualizar Datos Básicos de la Empresa
          const { error: updateError } = await supabase
              .from('companies')
              .update({
                  name: editData.name,
                  business_type: editData.business_type,
                  status: editData.status
              })
              .eq('id', editData.id);

          if (updateError) throw updateError;

          // 2. Asignar Nuevo Admin (Solo si se escribió algo en el campo)
          if (editData.newAdminEmail.trim() !== '') {
              // Llamada a la RPC creada en SQL
              const { error: rpcError } = await supabase.rpc('assign_company_admin', {
                  p_email: editData.newAdminEmail.trim(),
                  p_company_id: editData.id
              });

              if (rpcError) throw rpcError;
              alert("✅ Datos actualizados y nuevo Administrador vinculado.");
          } else {
              alert("✅ Datos de empresa actualizados.");
          }

          setShowEditModal(false);
          fetchData();

      } catch (error: any) {
          console.error(error);
          alert("Error al actualizar: " + error.message);
      } finally {
          setIsProcessing(false);
      }
  };

  // --- ELIMINAR ---
  const handleDelete = async (id: string, name: string) => {
      if (!confirm(`¿Borrar "${name}"?\nSe perderán los datos de esta empresa.`)) return;
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) alert("Error: " + error.message);
      else fetchData();
  };

  const getIconByType = (type: string) => {
      const icons: any = { pizzeria: <Store className="text-orange-500"/>, cerveceria: <Beer className="text-yellow-500"/>, cafeteria: <Coffee className="text-brown-500"/>, restaurante: <Utensils className="text-blue-500"/> };
      return icons[type] || <Building2 className="text-gray-500"/>;
  };

  const filtered = companies.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return <div className="p-10 text-center animate-pulse text-gray-500">Cargando Dashboard SaaS...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><ShieldCheck className="text-purple-600"/> Gestión SaaS</h2>
            <p className="text-sm text-gray-500">Administración global de empresas.</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-md transition-all">
            <Plus size={20} /> Nuevo Cliente
        </button>
      </div>

      {/* SEARCH */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 mb-6 flex items-center gap-2 shadow-sm">
        <Search className="text-gray-400" size={20}/>
        <input type="text" placeholder="Buscar empresa..." className="flex-1 outline-none text-gray-700" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                <tr><th className="p-4">Negocio</th><th className="p-4">Admin Principal</th><th className="p-4 text-center">Estado</th><th className="p-4 text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {filtered.map((co) => (
                    <tr key={co.id} className="hover:bg-gray-50">
                        <td className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-gray-100 p-2 rounded-lg">{getIconByType(co.business_type)}</div>
                                <div><p className="font-bold text-gray-800">{co.name}</p><p className="text-xs text-gray-400 capitalize">{co.business_type}</p></div>
                            </div>
                        </td>
                        <td className="p-4 text-sm text-gray-600 font-medium">
                            {adminMap[co.id] ? <span className="flex items-center gap-1"><UserCog size={14} className="text-purple-500"/> {adminMap[co.id]}</span> : <span className="text-gray-300 italic">Sin asignar</span>}
                        </td>
                        <td className="p-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${co.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>{co.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                        </td>
                        <td className="p-4 text-right flex justify-end gap-2">
                            <button onClick={() => openEditModal(co)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit size={18}/></button>
                            <button onClick={() => handleDelete(co.id, co.name)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* MODAL CREAR CLIENTE (Simplificado) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg text-purple-700">Nuevo Cliente</h3><button onClick={() => setShowCreateModal(false)}><X/></button></div>
                <form onSubmit={handleCreateClient} className="space-y-4">
                    <input required placeholder="Nombre Fantasía" className="w-full p-2 border rounded" value={createData.businessName} onChange={e => setCreateData({...createData, businessName: e.target.value})} />
                    <select className="w-full p-2 border rounded bg-white" value={createData.businessType} onChange={e => setCreateData({...createData, businessType: e.target.value})}>
                        <option value="pizzeria">🍕 Pizzería</option><option value="cerveceria">🍺 Cervecería</option><option value="restaurante">🍽️ Restaurante</option><option value="cafeteria">☕ Cafetería</option>
                    </select>
                    <input required type="email" placeholder="Email Admin" className="w-full p-2 border rounded" value={createData.adminEmail} onChange={e => setCreateData({...createData, adminEmail: e.target.value})} />
                    <input required type="password" placeholder="Contraseña" className="w-full p-2 border rounded" value={createData.adminPassword} onChange={e => setCreateData({...createData, adminPassword: e.target.value})} />
                    <button type="submit" disabled={isProcessing} className="w-full bg-purple-600 text-white font-bold py-3 rounded hover:bg-purple-700">{isProcessing ? 'Creando...' : 'Registrar'}</button>
                </form>
            </div>
        </div>
      )}

      {/* MODAL EDITAR CLIENTE (Con Asignación de Admin) */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-gray-900 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold flex items-center gap-2"><Edit size={18}/> Editar Empresa</h3>
                    <button onClick={() => setShowEditModal(false)}><X/></button>
                </div>
                
                <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                    {/* Datos Básicos */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Nombre</label>
                        <input className="w-full p-2 border rounded focus:ring-2 focus:ring-purple-500 outline-none" 
                            value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Rubro</label>
                            <select className="w-full p-2 border rounded bg-white" value={editData.business_type} onChange={e => setEditData({...editData, business_type: e.target.value})}>
                                <option value="pizzeria">Pizzería</option><option value="cerveceria">Cervecería</option><option value="restaurante">Restaurante</option><option value="cafeteria">Cafetería</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Estado</label>
                            <div className="flex items-center gap-2 mt-2">
                                <button type="button" onClick={() => setEditData({...editData, status: editData.status === 'active' ? 'inactive' : 'active'})} 
                                    className={`flex-1 font-bold text-xs py-1.5 rounded transition-colors ${editData.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                    {editData.status === 'active' ? 'ACTIVO' : 'INACTIVO'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100 my-2"></div>

                    {/* Sección Admin */}
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                        <label className="text-xs font-bold text-yellow-800 uppercase flex items-center gap-1 mb-1">
                            <UserCog size={14}/> Reasignar Admin
                        </label>
                        <p className="text-xs text-gray-600 mb-2">Admin actual: <strong>{editData.currentAdminEmail}</strong></p>
                        
                        <input 
                            type="email" 
                            placeholder="Nuevo Email (Debe estar registrado)" 
                            className="w-full p-2 border border-yellow-300 rounded focus:ring-2 focus:ring-yellow-500 outline-none text-sm"
                            value={editData.newAdminEmail}
                            onChange={e => setEditData({...editData, newAdminEmail: e.target.value})}
                        />
                        <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                            <AlertTriangle size={10}/> Se transferirán los permisos de admin a este usuario.
                        </p>
                    </div>

                    <button type="submit" disabled={isProcessing} className="w-full bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-700 shadow-md transition-all mt-2">
                        {isProcessing ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}