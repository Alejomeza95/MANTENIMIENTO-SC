import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  CheckCircle, 
  XCircle, 
  Shield, 
  Phone, 
  BadgeCheck,
  X,
  Eye,
  EyeOff,
  User as UserIcon,
  Edit2,
  Loader2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Technician, TechnicianArea, User } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { useFirestoreCollection, addFirestoreDoc, updateFirestoreDoc, deleteFirestoreDoc } from '../../lib/firestoreHooks';

const AREAS: TechnicianArea[] = ['Mecánico', 'Eléctrico', 'Electrónico', 'Biomédico', 'Procesos'];

export default function TechniciansPage() {
  const { data: users, loading } = useFirestoreCollection<User>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    area: 'Mecánico' as TechnicianArea,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE'
  });

  const technicians = useMemo(() => 
    users.filter(u => u.role === 'TECHNICIAN' || (u as any).area) as Technician[], 
  [users]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (editingId) {
        const updateData: any = { ...formData };
        if (!formData.password) delete updateData.password;
        
        await updateFirestoreDoc('users', editingId, {
          ...updateData,
          updatedAt: new Date().toISOString()
        });
      } else {
        const newTech: any = {
          ...formData,
          role: 'TECHNICIAN',
          createdAt: new Date().toISOString(),
          email: `${formData.username.toLowerCase()}@purebackbone.com` // Dummy email for consistency if needed
        };
        await addFirestoreDoc('users', newTech);
      }
      handleCloseModal();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (tech: Technician) => {
    setEditingId(tech.id);
    setFormData({
      username: tech.username,
      password: '', // Don't show password
      firstName: tech.firstName,
      lastName: tech.lastName,
      phone: tech.phone || '',
      area: tech.area,
      status: tech.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Está seguro de eliminar este perfil de técnico? Esta acción no se puede deshacer.')) {
      try {
        await deleteFirestoreDoc('users', id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const toggleStatus = async (tech: Technician) => {
    const newStatus: 'ACTIVE' | 'INACTIVE' = tech.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateFirestoreDoc('users', tech.id, { status: newStatus });
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({
      username: '',
      password: '',
      firstName: '',
      lastName: '',
      phone: '',
      area: 'Mecánico',
      status: 'ACTIVE'
    });
    setShowPassword(false);
  };

  const filteredTechs = technicians.filter(t => 
    `${t.firstName} ${t.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.area.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-slate-500 font-medium mt-4">Cargando técnicos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestión de Técnicos</h1>
          <p className="text-slate-500 mt-1">Administra los perfiles de acceso y especialidades del personal técnico.</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
        >
          <UserPlus size={20} />
          NUEVO TÉCNICO
        </button>
      </div>

      <div className="relative w-full">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por nombre, usuario o área..."
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all text-sm font-medium shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-20">Avatar</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Técnico</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuario</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Especialidad</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            <AnimatePresence mode="popLayout">
              {filteredTechs.map((tech) => (
                <motion.tr
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={tech.id}
                  className={cn(
                    "hover:bg-slate-50/50 transition-colors group",
                    tech.status === 'INACTIVE' && "bg-slate-50/30 grayscale-[0.5]"
                  )}
                >
                  <td className="px-6 py-3 text-center">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-white mx-auto shadow-sm",
                      tech.status === 'ACTIVE' ? "bg-blue-600" : "bg-slate-400"
                    )}>
                      <UserIcon size={20} />
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{tech.firstName} {tech.lastName}</span>
                      {tech.status === 'ACTIVE' && <BadgeCheck size={14} className="text-blue-500" />}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Phone size={10} className="text-slate-400" />
                      <span className="text-[10px] text-slate-500 font-medium">{tech.phone || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">@{tech.username}</span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                       <Shield size={12} className="text-slate-400" />
                       <span className="text-[10px] font-bold uppercase text-slate-500">{tech.area}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter",
                      tech.status === 'ACTIVE' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                    )}>
                      {tech.status}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEdit(tech)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white border border-transparent hover:border-slate-100 rounded-lg transition-all"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => toggleStatus(tech)}
                        className={cn(
                          "p-2 rounded-lg transition-all border border-transparent",
                          tech.status === 'ACTIVE' 
                            ? "text-slate-400 hover:text-rose-600 hover:bg-white hover:border-slate-100" 
                            : "text-slate-400 hover:text-emerald-600 hover:bg-white hover:border-slate-100"
                        )}
                        title={tech.status === 'ACTIVE' ? "Desactivar" : "Activar"}
                      >
                        {tech.status === 'ACTIVE' ? <XCircle size={16} /> : <CheckCircle size={16} />}
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>

        {filteredTechs.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="text-slate-200" size={32} />
            </div>
            <p className="text-slate-400 font-medium italic">No se encontraron técnicos registrados.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 rounded-xl text-white">
                    <UserPlus size={20} />
                  </div>
                  <h3 className="font-black text-slate-900 tracking-tight uppercase">
                    {editingId ? 'Editar Técnico' : 'Registro de Técnico'}
                  </h3>
                </div>
                <button onClick={handleCloseModal} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6 text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all text-sm font-medium"
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Apellido</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all text-sm font-medium"
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Usuario</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">@</span>
                      <input 
                        required
                        type="text" 
                        className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all text-sm font-medium"
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      {editingId ? 'Nueva Contraseña (Opcional)' : 'Contraseña'}
                    </label>
                    <div className="relative">
                      <input 
                        required={!editingId}
                        type={showPassword ? "text" : "password"} 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all text-sm font-medium"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
                    <input 
                      type="tel" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all text-sm font-medium"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Área / Especialidad</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all text-sm font-medium appearance-none"
                      value={formData.area}
                      onChange={(e) => setFormData({...formData, area: e.target.value as TechnicianArea})}
                    >
                      {AREAS.map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98] uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                    {editingId ? 'Actualizar Perfil' : 'Crear Perfil Técnico'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
