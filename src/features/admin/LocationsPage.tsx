import React, { useState } from 'react';
import { 
  MapPin, 
  Plus, 
  Trash2, 
  Edit2, 
  Loader2, 
  Search,
  X,
  Building
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Location } from '../../types';
import { useFirestoreCollection, addFirestoreDoc, updateFirestoreDoc, deleteFirestoreDoc } from '../../lib/firestoreHooks';

export default function LocationsPage() {
  const { data: locations, loading } = useFirestoreCollection<Location>('locations');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    department: '',
    city: '',
    place: '',
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const name = `${formData.department} - ${formData.city} - ${formData.place}`;
      const payload = {
        ...formData,
        name,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await updateFirestoreDoc('locations', editingId, payload);
        setNotification('Sede actualizada correctamente');
      } else {
        await addFirestoreDoc('locations', {
          ...payload,
          createdAt: new Date().toISOString()
        });
        setNotification('Nueva sede registrada correctamente');
      }
      
      resetForm();
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error(error);
      alert('Error al guardar la ubicación');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ department: '', city: '', place: '' });
    setEditingId(null);
  };

  const handleEdit = (location: Location) => {
    setEditingId(location.id);
    setFormData({
      department: location.department,
      city: location.city,
      place: location.place
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteFirestoreDoc('locations', deleteConfirmId);
      setNotification('Ubicación eliminada');
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error(error);
      alert('Error al eliminar la ubicación');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const filteredLocations = locations.filter(loc => 
    loc.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loc.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loc.place.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-20 text-left relative">
      {notification && (
        <div className="fixed top-24 right-8 z-50 animate-in fade-in slide-in-from-top-4">
          <div className="bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl shadow-emerald-600/20 font-bold flex items-center gap-3">
            <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
              <MapPin size={14} />
            </div>
            {notification}
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
            <MapPin size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
              {editingId ? 'Editar Ubicación' : 'Registrar Nueva Ubicación'}
            </h2>
            <p className="text-slate-500 font-medium">Configure los sitios de mantenimiento (Departamento, Ciudad, Lugar).</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Departamento</label>
              <input 
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all text-sm font-medium"
                value={formData.department}
                onChange={(e) => setFormData({...formData, department: e.target.value})}
                placeholder="Ej: Antioquia"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ciudad</label>
              <input 
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all text-sm font-medium"
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                placeholder="Ej: Medellín"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lugar / Sede</label>
              <input 
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all text-sm font-medium"
                value={formData.place}
                onChange={(e) => setFormData({...formData, place: e.target.value})}
                placeholder="Ej: Clínica Central"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            {editingId && (
              <button 
                type="button"
                onClick={resetForm}
                className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all uppercase text-[11px] tracking-widest"
              >
                Cancelar
              </button>
            )}
            <button 
              disabled={isSubmitting}
              className="px-10 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 uppercase text-[11px] tracking-widest flex items-center gap-2"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : editingId ? <Edit2 size={16} /> : <Plus size={16} />}
              {editingId ? 'Actualizar Ubicación' : 'Registrar Ubicación'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Sedes Registradas</h3>
            <p className="text-slate-500 font-medium">Listado de ubicaciones disponibles en el sistema.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por ciudad, dpto o lugar..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all text-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Departamento</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ciudad</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lugar / Sede</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <Loader2 size={32} className="mx-auto text-blue-600 animate-spin" />
                    <p className="text-slate-400 mt-4 font-medium uppercase text-[10px] tracking-widest">Cargando ubicaciones...</p>
                  </td>
                </tr>
              ) : filteredLocations.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <MapPin size={24} className="text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-medium uppercase text-[10px] tracking-widest">No se encontraron ubicaciones</p>
                  </td>
                </tr>
              ) : (
                filteredLocations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <span className="text-sm font-bold text-slate-700">{loc.department}</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-bold text-slate-700">{loc.city}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-sm font-bold text-slate-900">{loc.place}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(loc)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(loc.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Confirmar Eliminación</h3>
                <p className="text-slate-500 font-medium text-sm mt-1">
                  ¿Está seguro de que desea eliminar esta ubicación? Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-8">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors uppercase text-[11px] tracking-widest"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-6 py-3 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-600/20 transition-all uppercase text-[11px] tracking-widest"
              >
                Eliminar Sede
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
