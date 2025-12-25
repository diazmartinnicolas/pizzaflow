import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { logAction } from '../services/audit'; 
import { createClient } from '@supabase/supabase-js'; 
import { Shield, User, X, UserPlus, CheckCircle, AlertCircle, Lock, Trash, Edit, Save } from 'lucide-react';

export default function Users() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  
  // Estado para el Modal (Crear / Editar)
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // Si existe, estamos editando
  const [userData, setUserData] = useState({ email: '', password: '', name: '', role: 'cashier' });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Obtener quién soy
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email || '';
    setCurrentUserEmail(email);

    const isDemo = email.toLowerCase().includes('demo');

    // === MODO SIMULACIÓN (DEMO) ===
    if (isDemo) {
        setProfiles([
            { id: 'demo-user', email: email, role: 'admin', full_name: 'Usuario Demo' }, 
            { id: 'fake-1', email: 'cajero@pizzaflow.com', role: 'cashier', full_name: 'Cajero Ejemplo' },
            { id: 'fake-2', email: 'cocina@pizzaflow.com', role: 'cocina', full_name: 'Chef Mario' },
            { id: 'fake-3', email: 'admin@pizzaflow.com', role: 'admin', full_name: 'Socio Admin' }
        ]);
        setCurrentUserRole('admin'); 
        setLoading(false);
        return; 
    }

    // === MODO REAL (ADMIN) ===
    if (user) {
        const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        setCurrentUserRole(myProfile?.role || 'cashier');
    }

    // Traemos perfiles. Nota: El nombre real suele estar en raw_user_meta_data de auth.users, 
    // pero aquí usaremos el email como identificador principal o un campo name si lo agregaste a profiles.
    // Para simplificar, mostramos Email y Rol.
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .order('email', { ascending: true });
    
    if (profilesData) setProfiles(profilesData);
    setLoading(false);
  };

  // --- ABRIR MODAL (CREAR O EDITAR) ---
  const openModal = (userToEdit: any = null) => {
      if (userToEdit) {
          // MODO EDITAR
          setEditingId(userToEdit.id);
          setUserData({ 
              email: userToEdit.email, 
              password: '', // No mostramos la pass actual
              name: userToEdit.full_name || '', // Si tuvieras columna name
              role: userToEdit.role 
          });
      } else {
          // MODO CREAR
          setEditingId(null);
          setUserData({ email: '', password: '', name: '', role: 'cashier' });
      }
      setShowModal(true);
  };

  // --- GUARDAR (CREAR O EDITAR) ---
  const handleSaveUser = async () => {
    // 1. Validaciones
    if (currentUserEmail.includes('demo')) {
        // LÓGICA DEMO
        if (editingId) {
            setProfiles(profiles.map(p => p.id === editingId ? { ...p, ...userData } : p));
            logAction('EDITAR_USUARIO', `(Simulado) Editado: ${userData.email}`, 'Usuarios');
            alert("Usuario editado en MEMORIA (Modo Demo).");
        } else {
            setProfiles([...profiles, { id: `fake-${Date.now()}`, ...userData }]);
            logAction('CREAR_USUARIO', `(Simulado) Nuevo: ${userData.email}`, 'Usuarios');
            alert("Usuario creado en MEMORIA (Modo Demo).");
        }
        setShowModal(false);
        return;
    }

    // LÓGICA REAL (ADMIN)
    if (!userData.email || !userData.role) return alert("Faltan datos obligatorios.");
    // Si es nuevo, pass obligatoria. Si edita, opcional.
    if (!editingId && userData.password.length < 6) return alert("Contraseña mínima: 6 caracteres.");
    
    setIsProcessing(true);

    try {
        if (editingId) {
            // --- EDICIÓN REAL ---
            
            // 1. Llamar a la función SQL para actualizar Auth (Email, Pass, Metadata)
            const { error: rpcError } = await supabase.rpc('update_user_by_admin', {
                target_user_id: editingId,
                new_email: userData.email,
                new_password: userData.password || null, // Si está vacío, no la cambia
                new_name: userData.name
            });

            if (rpcError) throw rpcError;

            // 2. Actualizar el ROL en Profiles (si cambió)
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ role: userData.role })
                .eq('id', editingId);

            if (profileError) throw profileError;

            await logAction('EDITAR_USUARIO', `Usuario editado: ${userData.email}`, 'Usuarios');
            alert("Usuario actualizado correctamente.");

        } else {
            // --- CREACIÓN REAL (Usando el truco del cliente temporal) ---
            
            // @ts-ignore
            const tempSupabase = createClient(supabase.supabaseUrl, supabase.supabaseKey);
            const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                email: userData.email,
                password: userData.password,
                options: { data: { full_name: userData.name } }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("Error al crear en Auth.");

            // Upsert en Profiles
            const { error: upsertError } = await supabase
                .from('profiles')
                .upsert({ id: authData.user.id, email: userData.email, role: userData.role });

            if (upsertError) throw upsertError;

            await logAction('CREAR_USUARIO', `Nuevo usuario: ${userData.email}`, 'Usuarios');
            alert("Usuario creado correctamente.");
        }

        setShowModal(false);
        fetchData();

    } catch (error: any) {
        console.error("Error al guardar:", error);
        alert("Error: " + error.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // --- ELIMINAR ---
  const handleDeleteUser = async (userId: string) => {
     if (currentUserEmail.includes('demo')) {
         if(confirm("Modo Demo: ¿Simular eliminación?")) {
             setProfiles(profiles.filter(p => p.id !== userId));
             logAction('ELIMINAR_USUARIO', `(Simulado) Usuario ${userId}`, 'Usuarios');
         }
         return;
     }

     if (currentUserRole !== 'admin') return alert("Solo administradores pueden eliminar usuarios.");
     
     // No borrarte a ti mismo
     const { data: { user } } = await supabase.auth.getUser();
     if (user && user.id === userId) return alert("No puedes eliminar tu propio usuario.");

     if (!confirm("¿Estás seguro de ELIMINAR DEFINITIVAMENTE este usuario?")) return;

     // Llamada a RPC para borrado profundo
     const { error } = await supabase.rpc('delete_user_by_admin', { target_user_id: userId });

     if (error) {
         // Fallback perfil
         const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId);
         if (profileError) alert("Error al eliminar: " + error.message);
         else alert("Solo se borró el perfil (RPC falló).");
     } else {
         await logAction('ELIMINAR_USUARIO', `Usuario ${userId} eliminado`, 'Usuarios');
         setProfiles(profiles.filter(p => p.id !== userId));
         alert("Usuario eliminado correctamente.");
     }
  };

  // Actualización rápida de rol desde la tabla (sin abrir modal)
  const handleQuickRoleUpdate = async (userId: string, newRole: string) => {
    if (currentUserEmail.includes('demo')) return alert("Modo Demo: No puedes cambiar roles.");
    
    // Check de seguridad local
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.id === userId && newRole !== 'admin') return alert("No puedes quitarte admin a ti mismo.");

    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) alert("Error: " + error.message);
    else {
        await logAction('ROL_MODIFICADO', `Rol cambiado a ${newRole}`, 'Usuarios');
        setProfiles(profiles.map(p => p.id === userId ? { ...p, role: newRole } : p));
    }
  };

  const renderRoleBadge = (role: string) => {
    const styles: any = {
        admin: 'bg-purple-100 text-purple-700 border-purple-200',
        cashier: 'bg-green-100 text-green-700 border-green-200',
        cocina: 'bg-orange-100 text-orange-700 border-orange-200',
    };
    return (
        <span className={`px-2 py-1 rounded text-[10px] font-bold border uppercase ${styles[role] || 'bg-gray-100 text-gray-600'}`}>
            {role}
        </span>
    );
  };

  const isDemo = currentUserEmail.includes('demo');

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando usuarios...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Shield className="text-purple-600"/> Gestión de Usuarios
        </h2>
        
        {currentUserRole === 'admin' && (
            <button 
                onClick={() => openModal()}
                className={`text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-medium ${isDemo ? 'bg-orange-500 hover:bg-orange-600' : 'bg-purple-600 hover:bg-purple-700'}`}
            >
                <UserPlus size={18} /> Nuevo Usuario
            </button>
        )}
      </div>

      {isDemo && (
          <div className="mb-4 bg-orange-50 text-orange-800 p-3 rounded-lg flex items-center gap-2 text-sm border border-orange-200">
              <Lock size={16} />
              <span><strong>Modo Demo:</strong> Puedes editar y borrar visualmente, pero no afecta la base de datos.</span>
          </div>
      )}

      {/* MODAL UNIVERSAL (CREAR / EDITAR) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className={`${isDemo ? 'bg-orange-500' : 'bg-purple-600'} p-4 flex justify-between items-center text-white`}>
                    <h3 className="font-bold flex items-center gap-2">
                        {editingId ? <Edit size={20}/> : <UserPlus size={20}/>} 
                        {editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
                    </h3>
                    <button onClick={() => setShowModal(false)} className="hover:bg-white/20 p-1 rounded"><X size={20}/></button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre</label>
                        <input type="text" placeholder="Ej: Juan Pérez" className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                            value={userData.name} onChange={e => setUserData({...userData, name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                        <input type="email" placeholder="usuario@pizzaflow.com" className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                            value={userData.email} onChange={e => setUserData({...userData, email: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            {editingId ? 'Nueva Contraseña (Opcional)' : 'Contraseña'}
                        </label>
                        <input type="password" placeholder={editingId ? "Dejar vacía para no cambiar" : "Mínimo 6 caracteres"} 
                            className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                            value={userData.password} onChange={e => setUserData({...userData, password: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rol</label>
                        <select className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                            value={userData.role} onChange={e => setUserData({...userData, role: e.target.value})}
                        >
                            <option value="cashier">Cajero (Ventas)</option>
                            <option value="cocina">Cocina (Pantalla)</option>
                            <option value="admin">Administrador (Total)</option>
                        </select>
                    </div>
                    
                    <button 
                        onClick={handleSaveUser} 
                        disabled={isProcessing}
                        className={`w-full text-white font-bold py-3 rounded-lg mt-2 flex justify-center items-center gap-2 transition-all ${isDemo ? 'bg-orange-500 hover:bg-orange-600' : 'bg-purple-600 hover:bg-purple-700'}`}
                    >
                        {isProcessing ? 'Procesando...' : <><Save size={18}/> {editingId ? 'Guardar Cambios' : 'Crear Usuario'}</>}
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Usuario</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Rol</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {profiles.map((profile) => (
                        <tr key={profile.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-gray-100 p-2 rounded-full text-gray-500">
                                        <User size={18} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 text-sm">{profile.full_name || 'Usuario'}</p>
                                        <p className="text-xs text-gray-500">{profile.email} 
                                            {profile.email === currentUserEmail && <span className="ml-1 text-blue-600 font-bold">(Tú)</span>}
                                        </p>
                                    </div>
                                </div>
                            </td>
                            <td className="p-4">
                                {renderRoleBadge(profile.role)}
                            </td>
                            <td className="p-4 flex items-center gap-2">
                                {/* Selector Rápido */}
                                <select 
                                    className={`bg-white border border-gray-200 text-gray-700 text-xs rounded-lg block p-2 outline-none ${isDemo ? 'opacity-50' : 'cursor-pointer hover:border-purple-300'}`}
                                    value={profile.role}
                                    onChangeCapture={(e: any) => handleQuickRoleUpdate(profile.id, e.target.value)}
                                    disabled={currentUserRole !== 'admin'}
                                >
                                    <option value="admin">Admin</option>
                                    <option value="cashier">Cajero</option>
                                    <option value="cocina">Cocina</option>
                                </select>

                                {/* BOTONES ACCIÓN (Solo Admin y No uno mismo) */}
                                {currentUserRole === 'admin' && profile.email !== currentUserEmail && (
                                    <>
                                        <button 
                                            onClick={() => openModal(profile)}
                                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Editar datos"
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteUser(profile.id)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Eliminar usuario"
                                        >
                                            <Trash size={18} />
                                        </button>
                                    </>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}