import React, { useState, useRef, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Trash2, 
  Image as ImageIcon, 
  FileText, 
  Save,
  Wrench,
  Info,
  X,
  Upload,
  Archive,
  CheckCircle,
  RotateCcw,
  Edit2,
  FileDown,
  Calendar,
  Loader2,
  FileSpreadsheet,
  MapPin,
  Layers
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Asset, MaintenanceActivity, Location, SparePart } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../../store/useAuthStore';
import { useFirestoreCollection, addFirestoreDoc, updateFirestoreDoc, deleteFirestoreDoc } from '../../lib/firestoreHooks';
import { jsPDF } from 'jspdf';

export default function AssetsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const { data: assets, loading: loadingAssets } = useFirestoreCollection<Asset>('assets');
  const { data: locations } = useFirestoreCollection<Location>('locations');
  const { data: spareParts } = useFirestoreCollection<SparePart>('spare_parts');

  const [activities, setActivities] = useState<MaintenanceActivity[]>([
    { id: '1', description: '', frequencyWeeks: 4, type: 'MAINTENANCE' }
  ]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    serialNumber: '',
    year: new Date().getFullYear(),
    type: 'INTERNO' as 'INTERNO' | 'EXTERNO',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED',
    brand: '',
    model: '',
    invimaRegistration: '',
    commercializationPermit: '',
    manufacturerInfo: '',
    supplierInfo: '',
    institutionalInventoryNumber: '',
    locationId: '',
  });

  // File Upload State
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const addActivity = () => {
    setActivities([...activities, { id: Math.random().toString(36).substr(2, 9), description: '', frequencyWeeks: 4, priority: 'MEDIA', type: 'MAINTENANCE' }]);
  };

  const removeActivity = (id: string) => {
    if (activities.length > 1) {
      setActivities(activities.filter(a => a.id !== id));
    }
  };

  const updateActivity = (id: string, field: keyof MaintenanceActivity, value: any) => {
    setActivities(activities.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const calculateRepetitions = (freq: number) => {
    if (!freq || freq <= 0) return '';
    const reps = [];
    for (let i = freq; i <= 54; i += freq) {
      reps.push(i);
    }
    return reps.join(', ');
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setManualUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const removeManual = () => {
    setManualUrl(null);
    if (manualInputRef.current) manualInputRef.current.value = '';
  };

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      serialNumber: '',
      year: new Date().getFullYear(),
      type: 'INTERNO',
      status: 'ACTIVE',
      brand: '',
      model: '',
      invimaRegistration: '',
      commercializationPermit: '',
      manufacturerInfo: '',
      supplierInfo: '',
      institutionalInventoryNumber: '',
      locationId: '',
    });
    setActivities([{ id: '1', description: '', frequencyWeeks: 4, priority: 'MEDIA', type: 'MAINTENANCE' }]);
    setEditingId(null);
    removeImage();
    removeManual();
    setQuantity(1);
  };

  const editAsset = (asset: Asset, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData({
      name: asset.name,
      description: asset.description || '',
      serialNumber: asset.serialNumber || '',
      year: asset.year || new Date().getFullYear(),
      type: asset.type || 'INTERNO',
      status: (asset.status as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED') || 'ACTIVE',
      brand: asset.brand || '',
      model: asset.model || '',
      invimaRegistration: asset.invimaRegistration || '',
      commercializationPermit: asset.commercializationPermit || '',
      manufacturerInfo: asset.manufacturerInfo || '',
      supplierInfo: asset.supplierInfo || '',
      institutionalInventoryNumber: asset.institutionalInventoryNumber || '',
      locationId: asset.locationId || '',
    });
    setActivities(asset.activities.length > 0 ? asset.activities.map(a => ({ ...a, priority: a.priority || 'MEDIA', type: a.type || 'MAINTENANCE' })) : [{ id: '1', description: '', frequencyWeeks: 4, priority: 'MEDIA', type: 'MAINTENANCE' }]);
    setEditingId(asset.id);
    setImagePreview(asset.imageUrl || null);
    setManualUrl(asset.manualUrl || null);
    setSelectedAsset(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const archiveAsset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setArchiveConfirmId(id);
  };

  const confirmArchive = async () => {
    if (!archiveConfirmId) return;
    try {
      await updateFirestoreDoc('assets', archiveConfirmId, { status: 'ARCHIVED' });
      if (selectedAsset?.id === archiveConfirmId) {
        setSelectedAsset(null);
      }
      setNotification('Equipo movido al archivo exitosamente.');
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Error al archivar el equipo');
    } finally {
      setArchiveConfirmId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteFirestoreDoc('assets', deleteConfirmId);
      if (selectedAsset?.id === deleteConfirmId) {
        setSelectedAsset(null);
      }
      setNotification('Equipo eliminado permanentemente.');
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el equipo');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const assetData = {
        ...formData,
        activities: activities.filter(a => a.description.trim() !== ''),
        imageUrl: imagePreview || null,
        manualUrl: manualUrl || null,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await updateFirestoreDoc('assets', editingId, assetData);
        setNotification('¡Equipo actualizado correctamente!');
      } else {
        // Bulk creation
        for (let i = 0; i < quantity; i++) {
          const suffix = quantity > 1 ? ` (${i + 1})` : '';
          await addFirestoreDoc('assets', {
            ...assetData,
            name: assetData.name + suffix,
            serialNumber: assetData.serialNumber ? assetData.serialNumber + (quantity > 1 ? `-${i + 1}` : '') : '',
            createdAt: new Date().toISOString(),
            status: 'ACTIVE'
          });
        }
        setNotification(quantity > 1 ? `¡${quantity} equipos creados correctamente!` : '¡Equipo creado correctamente!');
      }

      resetForm();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const downloadAssetResume = (asset: Asset) => {
    const doc = new jsPDF();
    const margin = 20;
    let y = 20;

    // Header Box
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('HOJA DE VIDA DEL EQUIPO', margin, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const today = new Date().toLocaleDateString();
    doc.text(`FECHA DE GENERACIÓN: ${today}`, margin, 33);
    
    y = 55;
    
    // 1. IDENTIFICACIÓN
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('1. IDENTIFICACIÓN GENERAL', margin, y);
    y += 10;
    
    doc.setFontSize(10);
    const idFields = [
      ['NOMBRE:', asset.name],
      ['UBICACIÓN:', locations.find(l => l.id === asset.locationId)?.name || 'NO ASIGNADA'],
      ['MARCA:', asset.brand || 'N/A'],
      ['MODELO:', asset.model || 'N/A'],
      ['SERIE:', asset.serialNumber || 'N/A'],
      ['ID INVENTARIO:', asset.institutionalInventoryNumber || 'N/A'],
      ['AÑO FABRICACIÓN:', asset.year?.toString() || 'N/A'],
      ['TIPO:', asset.type || 'INTERNO']
    ];
    
    idFields.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value || '', margin + 50, y);
      y += 7;
    });

    if (asset.imageUrl) {
      try {
        doc.addImage(asset.imageUrl, 'JPEG', 145, 60, 45, 45);
      } catch (e) {}
    }

    if (asset.manualUrl) {
      doc.setFontSize(9);
      doc.setTextColor(37, 99, 235);
      doc.text('MANUAL TÉCNICO DISPONIBLE EN EL SISTEMA', margin, y);
      doc.setTextColor(15, 23, 42);
      y += 7;
    }
    
    y += 10;
    
    // 2. ESPECIFICACIONES TÉCNICAS Y LEGALES
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('2. ESPECIFICACIONES TÉCNICAS Y LEGALES', margin, y);
    y += 10;
    
    doc.setFontSize(10);
    const legalFields = [
      ['REGISTRO INVIMA:', asset.invimaRegistration || 'N/A'],
      ['PERMISO COMERCIALIZACIÓN:', asset.commercializationPermit || 'N/A'],
      ['FABRICANTE:', asset.manufacturerInfo || 'N/A'],
      ['PROVEEDOR:', asset.supplierInfo || 'N/A']
    ];
    
    legalFields.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value || '', margin + 70, y);
      y += 7;
    });
    
    y += 10;
    
    // 3. PLAN DE MANTENIMIENTO
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('3. PLAN DE MANTENIMIENTO PROGRAMADO', margin, y);
    y += 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('ACTIVIDAD', margin, y);
    doc.text('TIPO', margin + 90, y);
    doc.text('FRECUENCIA', margin + 130, y);
    doc.text('PRIORIDAD', margin + 160, y);
    y += 2;
    doc.line(margin, y, 190, y);
    y += 7;
    
    doc.setFont('helvetica', 'normal');
    asset.activities.forEach(act => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const desc = doc.splitTextToSize(act.description, 85);
      doc.text(desc, margin, y);
      doc.text(act.type === 'CALIBRATION' ? 'CALIB.' : 'MANTO.', margin + 90, y);
      doc.text(`${act.frequencyWeeks} SEM.`, margin + 130, y);
      doc.text(act.type === 'CALIBRATION' ? '-' : (act.priority || 'MEDIA'), margin + 160, y);
      y += (desc.length * 5) + 2;
    });
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Este documento es una hoja de vida técnica generada por el sistema CMMS Inteligente.', 105, 285, { align: 'center' });
    
    doc.save(`Hoja_de_Vida_${asset.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-8 pb-12 relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-bold text-sm tracking-wide border border-emerald-500/20"
          >
            <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
              <CheckCircle size={14} />
            </div>
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {editingId ? 'Editar Equipo' : 'Gestión de Activos'}
          </h1>
          <p className="text-slate-500 mt-1">
            {editingId ? `Modificando ${formData.name}` : 'Registre y administre los equipos de la planta.'}
          </p>
        </div>
        {editingId ? (
          <button 
            onClick={resetForm}
            className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 transition-all flex items-center gap-2"
          >
            <X size={18} />
            CANCELAR EDICIÓN
          </button>
        ) : (
          isAdmin && (
            <button 
              onClick={() => {
                resetForm();
                // We'll use the form scroll to top instead of a modal here as the form is inline
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
            >
              <Plus size={18} />
              NUEVO EQUIPO
            </button>
          )
        )}
      </div>

      {loadingAssets ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-medium mt-4">Sincronizando activos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className={cn(isAdmin ? "lg:col-span-2" : "lg:col-span-3", "space-y-6")}>
            {isAdmin && (
              <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-left">
                <div className="p-8 space-y-8">
                  {/* Basic Info */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <Info className="text-blue-600" size={18} />
                      <h2 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Información Básica</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Nombre del Equipo <span className="text-rose-500">*</span></label>
                        <input 
                          type="text" 
                          required
                          placeholder="Ej. Compresor Atlas Copco"
                          className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none font-medium text-slate-800"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Número de Serie</label>
                        <input 
                          type="text" 
                          placeholder="SN-XXXX-XXXX"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none font-medium text-slate-800"
                          value={formData.serialNumber}
                          onChange={(e) => setFormData({...formData, serialNumber: e.target.value})}
                        />
                      </div>

                      <div className="space-y-2 text-left">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Marca</label>
                        <input 
                          type="text" 
                          placeholder="Ej. Philips, Siemens"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none font-medium text-slate-800"
                          value={formData.brand}
                          onChange={(e) => setFormData({...formData, brand: e.target.value})}
                         />
                      </div>
                      <div className="space-y-2 text-left">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Modelo</label>
                        <input 
                          type="text" 
                          placeholder="Ej. V120, Optima"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none font-medium text-slate-800"
                          value={formData.model}
                          onChange={(e) => setFormData({...formData, model: e.target.value})}
                         />
                      </div>

                      <div className="space-y-2 text-left">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Reg. INVIMA</label>
                        <input 
                          type="text" 
                          placeholder="Ej. INVIMA 2024-XXXX"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none font-medium text-slate-800"
                          value={formData.invimaRegistration}
                          onChange={(e) => setFormData({...formData, invimaRegistration: e.target.value})}
                         />
                      </div>
                      <div className="space-y-2 text-left">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Permiso de Comercialización</label>
                        <input 
                          type="text" 
                          placeholder="Número de permiso..."
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none font-medium text-slate-800"
                          value={formData.commercializationPermit}
                          onChange={(e) => setFormData({...formData, commercializationPermit: e.target.value})}
                         />
                      </div>

                      <div className="space-y-2 text-left">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Fabricante</label>
                        <input 
                          type="text" 
                          placeholder="Razón Social del Fabricante"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none font-medium text-slate-800"
                          value={formData.manufacturerInfo}
                          onChange={(e) => setFormData({...formData, manufacturerInfo: e.target.value})}
                         />
                      </div>
                      <div className="space-y-2 text-left">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Proveedor</label>
                        <input 
                          type="text" 
                          placeholder="Datos del proveedor..."
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none font-medium text-slate-800"
                          value={formData.supplierInfo}
                          onChange={(e) => setFormData({...formData, supplierInfo: e.target.value})}
                         />
                      </div>

                      <div className="space-y-2 text-left">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Ubicación / Sede <span className="text-rose-500">*</span></label>
                        <select 
                          required
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none font-medium text-slate-800"
                          value={formData.locationId}
                          onChange={(e) => setFormData({...formData, locationId: e.target.value})}
                        >
                          <option value="">Seleccionar Sede...</option>
                          {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">N° Inventario Institucional</label>
                        <input 
                          type="text" 
                          placeholder="Ej. INV-HOSP-001"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none font-medium text-slate-800"
                          value={formData.institutionalInventoryNumber}
                          onChange={(e) => setFormData({...formData, institutionalInventoryNumber: e.target.value})}
                         />
                      </div>

                      {!editingId && (
                        <div className="space-y-2 text-left">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Cantidad de Activos</label>
                          <input 
                            type="number" 
                            min="1"
                            max="50"
                            className="w-full px-4 py-2.5 bg-slate-100 border-2 border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none font-black text-blue-600"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          />
                        </div>
                      )}

                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Descripción</label>
                        <textarea 
                          rows={3}
                          placeholder="Detalles sobre la función y ubicación del activo..."
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none font-medium text-slate-800 resize-none"
                          value={formData.description}
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Año de Fabricación</label>
                        <input 
                          type="number" 
                          min="1900" 
                          max={new Date().getFullYear() + 1}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none font-medium text-slate-800"
                          value={formData.year}
                          onChange={(e) => setFormData({...formData, year: parseInt(e.target.value) || 0})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Tipo de Mantenimiento</label>
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => setFormData({...formData, type: 'INTERNO'})}
                            className={cn(
                              "flex-1 py-2.5 rounded-lg border text-sm font-bold transition-all",
                              formData.type === 'INTERNO' 
                                ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-blue-600/10" 
                                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            INTERNO
                          </button>
                          <button 
                            type="button"
                            onClick={() => setFormData({...formData, type: 'EXTERNO'})}
                            className={cn(
                              "flex-1 py-2.5 rounded-lg border text-sm font-bold transition-all",
                              formData.type === 'EXTERNO' 
                                ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-blue-600/10" 
                                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            EXTERNO
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Estado Operativo</label>
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => setFormData({...formData, status: 'ACTIVE'})}
                            className={cn(
                              "flex-1 py-2.5 rounded-lg border text-sm font-bold transition-all flex items-center justify-center gap-2",
                              formData.status === 'ACTIVE' 
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/10" 
                                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            <CheckCircle size={16} />
                            ACTIVO
                          </button>
                          <button 
                            type="button"
                            onClick={() => setFormData({...formData, status: 'INACTIVE'})}
                            className={cn(
                              "flex-1 py-2.5 rounded-lg border text-sm font-bold transition-all flex items-center justify-center gap-2",
                              formData.status === 'INACTIVE' 
                                ? "bg-amber-600 text-white border-amber-600 shadow-lg shadow-amber-600/10" 
                                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            <X size={16} />
                            INACTIVO
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Activities */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <Wrench className="text-blue-600" size={18} />
                      <h2 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Plan de Actividades</h2>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Tareas y Frecuencias</label>
                        <button 
                          type="button"
                          onClick={addActivity}
                          className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-90"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        <AnimatePresence initial={false}>
                          {activities.map((activity, idx) => (
                            <motion.div 
                              key={activity.id}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 shadow-sm"
                            >
                              <div className="flex gap-2">
                                <div className="flex-1 relative">
                                  <span className="absolute left-3 top-3 text-[10px] font-bold text-slate-300">
                                    #{idx + 1}
                                  </span>
                                  <input 
                                    type="text"
                                    required
                                    placeholder="Describa la tarea de mantenimiento..."
                                    className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none text-sm font-medium text-slate-800"
                                    value={activity.description}
                                    onChange={(e) => updateActivity(activity.id, 'description', e.target.value)}
                                  />
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => removeActivity(activity.id)}
                                  disabled={activities.length === 1}
                                  className="p-2 text-slate-400 hover:text-red-600 transition-all disabled:opacity-0"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>

                              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                                <div className="flex items-center gap-2 pr-4 border-r border-slate-200">
                                  <input 
                                    type="checkbox"
                                    id={`is-cal-${activity.id}`}
                                    checked={activity.type === 'CALIBRATION'}
                                    onChange={(e) => updateActivity(activity.id, 'type', e.target.checked ? 'CALIBRATION' : 'MAINTENANCE')}
                                    className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500"
                                  />
                                  <label htmlFor={`is-cal-${activity.id}`} className="text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer">
                                    Calibración
                                  </label>
                                </div>

                                <div className="w-full md:w-32 space-y-1">
                                  <div className="flex justify-between text-[10px] font-bold text-slate-400">
                                    <span>FRECUENCIA</span>
                                    <span className="text-blue-600 uppercase tracking-tighter">{activity.frequencyWeeks} SEMANAS</span>
                                  </div>
                                  <input 
                                    type="range" 
                                    min="1" 
                                    max="54" 
                                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    value={activity.frequencyWeeks}
                                    onChange={(e) => updateActivity(activity.id, 'frequencyWeeks', parseInt(e.target.value))}
                                  />
                                </div>

                                {activity.type !== 'CALIBRATION' && (
                                  <div className="w-full md:w-32 space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prioridad</label>
                                    <select
                                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold uppercase transition-all outline-none"
                                      value={activity.priority || 'MEDIA'}
                                      onChange={(e) => updateActivity(activity.id, 'priority', e.target.value)}
                                    >
                                      <option value="ALTA">Alta</option>
                                      <option value="MEDIA">Media</option>
                                      <option value="BAJA">Baja</option>
                                    </select>
                                  </div>
                                )}

                                <div className="w-full md:w-32 space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none block mb-1">Repuesto Req.</label>
                                  <select
                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold uppercase transition-all outline-none cursor-pointer"
                                    value={activity.requiredPartId || ''}
                                    onChange={(e) => updateActivity(activity.id, 'requiredPartId', e.target.value)}
                                  >
                                    <option value="">Ninguno</option>
                                    {spareParts.map(sp => (
                                      <option key={sp.id} value={sp.id}>{sp.name}</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="flex-1">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Semanas Programadas:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {calculateRepetitions(activity.frequencyWeeks).split(', ').map(week => (
                                      <span key={week} className="text-[9px] font-bold bg-white border border-slate-200 px-1.5 py-0.5 rounded text-blue-600">
                                        SEM {week}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className={cn(
                        "w-full py-4 font-bold rounded-xl shadow-xl transition-all flex items-center justify-center gap-2 group",
                        isSubmitting && "opacity-70 cursor-not-allowed",
                        editingId 
                          ? "bg-blue-600 text-white shadow-blue-500/20 hover:bg-blue-700" 
                          : "bg-slate-950 text-white shadow-slate-950/20 hover:bg-slate-900"
                      )}
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (editingId ? <Save size={20} /> : <Plus size={20} />)}
                      <span>{editingId ? 'ACTUALIZAR CAMBIOS' : 'REGISTRAR ACTIVO'}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Asset List Area */}
            <div className="space-y-4 pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-900 border-l-4 border-blue-600 pl-4 tracking-tight uppercase text-sm">Equipos Registrados</h2>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold text-[10px] uppercase tracking-widest text-center">
                      <tr>
                        <th className="px-6 py-4">Equipo</th>
                        <th className="px-6 py-4">S/N</th>
                        <th className="px-6 py-4">Sede</th>
                        <th className="px-6 py-4">Estado</th>
                        <th className="px-6 py-4">Tareas</th>
                        <th className="px-6 py-4">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {assets.filter(a => (a.status || 'ACTIVE') === 'ACTIVE').length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                            No hay equipos activos registrados.
                          </td>
                        </tr>
                      ) : (
                        assets.filter(a => (a.status || 'ACTIVE') === 'ACTIVE').map((asset) => (
                          <tr 
                            key={asset.id} 
                            onClick={() => setSelectedAsset(asset)}
                            className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                                  {asset.imageUrl ? (
                                    <img src={asset.imageUrl} className="w-full h-full object-cover" />
                                  ) : <Package size={18} className="text-slate-300" />}
                                </div>
                                <div>
                                  <p className={cn(
                                    "font-bold group-hover:text-blue-600 transition-colors",
                                    asset.status === 'INACTIVE' ? "text-slate-400" : "text-slate-900"
                                  )}>{asset.name}</p>
                                  <p className="text-[10px] text-slate-400">{asset.type} • {asset.year}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-mono text-slate-500 text-center">{asset.serialNumber}</td>
                            <td className="px-6 py-4 text-center">
                               <div className="flex items-center justify-center gap-1.5">
                                 <MapPin size={12} className="text-slate-400" />
                                 <span className="text-[10px] font-bold text-slate-600 uppercase">
                                   {locations.find(l => l.id === asset.locationId)?.place || 'S/A'}
                                 </span>
                               </div>
                             </td>
                            <td className="px-6 py-4 text-center">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter",
                                (asset.status || 'ACTIVE') === 'ACTIVE' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                              )}>
                                {asset.status === 'INACTIVE' ? 'INACTIVO' : 'ACTIVO'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                {asset.activities.length} Tareas
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadAssetResume(asset);
                                  }}
                                  className="p-2 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                                  title="Descargar Hoja de Vida"
                                >
                                  <FileSpreadsheet size={16} />
                                </button>
                                {isAdmin && (
                                  <>
                                    <button 
                                      onClick={(e) => editAsset(asset, e)}
                                      className="p-2 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                                      title="Editar"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                    <button 
                                      onClick={(e) => archiveAsset(asset.id, e)}
                                      className="p-2 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                                      title="Dar de baja"
                                    >
                                      <Archive size={16} />
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirmId(asset.id);
                                      }}
                                      className="p-2 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                      title="Eliminar permanentemente"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Area - Only for Admins */}
          {isAdmin && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm sticky top-8">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Documentación y Medios</h3>
                
                <div className="space-y-6">
                  {/* Image Upload */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Imagen del Equipo</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={imageInputRef}
                      onChange={handleImageChange}
                    />
                    
                    {imagePreview ? (
                      <div className="relative group rounded-xl overflow-hidden aspect-video border border-slate-200 bg-slate-50">
                        <img src={imagePreview} alt="Vista previa" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <button 
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors"
                          >
                            <Upload size={18} />
                          </button>
                          <button 
                            type="button"
                            onClick={removeImage}
                            className="p-2 bg-rose-500/20 hover:bg-rose-500/40 rounded-full text-white transition-colors"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onClick={() => imageInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-blue-400 hover:bg-blue-50/10 transition-all cursor-pointer group"
                      >
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                          <ImageIcon className="text-slate-300 group-hover:text-blue-500" size={24} />
                        </div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">Subir Foto</p>
                        <p className="text-[10px] text-slate-400 mt-1">Formatos: JPG, PNG</p>
                      </div>
                    )}
                  </div>

                  {/* Manual Upload */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Manual Técnico</label>
                    <input 
                      type="file" 
                      accept=".pdf" 
                      className="hidden" 
                      ref={manualInputRef}
                      onChange={handleManualChange}
                    />
                    
                    {manualUrl ? (
                      <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                          <FileDown size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate uppercase tracking-tight">Manual Adjunto</p>
                        </div>
                        <button 
                          type="button"
                          onClick={removeManual}
                          className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <div 
                        onClick={() => manualInputRef.current?.click()}
                        className="flex items-center gap-4 p-4 border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/10 transition-all cursor-pointer group"
                      >
                        <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50 transition-colors">
                          <FileText size={20} />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-700 uppercase tracking-tight">Adjuntar PDF</p>
                          <p className="text-[10px] text-slate-400">Manual de usuario o plano</p>
                        </div>
                        <Plus size={16} className="text-slate-300" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/20">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-white/20 rounded-lg shrink-0">
                    <Package size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Gestión Semanal</h4>
                    <p className="text-xs text-blue-100 mt-1 leading-relaxed">
                      Las tareas se programarán automáticamente en un ciclo de 54 semanas según la frecuencia definida.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Asset Detail Modal */}
      <AnimatePresence>
        {selectedAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAsset(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <Package className="text-blue-600" size={20} />
                  <h3 className="font-bold text-slate-900 uppercase tracking-tight">Detalles del Equipo</h3>
                </div>
                <button 
                  onClick={() => setSelectedAsset(null)}
                  className="p-1 hover:bg-slate-200 rounded-lg transition-colors text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="aspect-square bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center relative group">
                      {selectedAsset.imageUrl ? (
                        <img src={selectedAsset.imageUrl} className="w-full h-full object-cover" />
                      ) : <Package size={48} className="text-slate-300" />}
                      <div className="absolute top-4 right-4 capitalize px-3 py-1 bg-white/90 backdrop-blur shadow-sm rounded-full text-[10px] font-black text-blue-600 border border-slate-100">
                        {selectedAsset.type}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="text-2xl font-black text-slate-900 tracking-tight">{selectedAsset.name}</h4>
                      <p className="text-sm font-medium text-slate-500 mt-1">{selectedAsset.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">S/N</p>
                        <p className="text-sm font-mono font-bold text-slate-700 truncate">{selectedAsset.serialNumber || 'N/A'}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Año</p>
                        <p className="text-sm font-bold text-slate-700">{selectedAsset.year || 'N/A'}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Marca</p>
                        <p className="text-sm font-bold text-slate-700">{selectedAsset.brand || 'N/A'}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Modelo</p>
                        <p className="text-sm font-bold text-slate-700">{selectedAsset.model || 'N/A'}</p>
                      </div>
                      {selectedAsset.invimaRegistration && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 col-span-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reg. INVIMA</p>
                          <p className="text-sm font-bold text-slate-700">{selectedAsset.invimaRegistration}</p>
                        </div>
                      )}
                      {selectedAsset.institutionalInventoryNumber && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 col-span-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">N° Inv. Institucional</p>
                          <p className="text-sm font-bold text-blue-600 font-mono text-xs">{selectedAsset.institutionalInventoryNumber}</p>
                        </div>
                      )}
                      {selectedAsset.commercializationPermit && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 col-span-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Permiso Comercialización</p>
                          <p className="text-sm font-bold text-slate-700">{selectedAsset.commercializationPermit}</p>
                        </div>
                      )}
                      {selectedAsset.manufacturerInfo && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fabricante</p>
                          <p className="text-sm font-bold text-slate-700 truncate">{selectedAsset.manufacturerInfo}</p>
                        </div>
                      )}
                      {selectedAsset.supplierInfo && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proveedor</p>
                          <p className="text-sm font-bold text-slate-700 truncate">{selectedAsset.supplierInfo}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h5 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Wrench size={14} className="text-blue-600" />
                        Plan de Mantenimiento
                      </h5>
                      <div className="space-y-2">
                        {selectedAsset.activities.map((act) => (
                          <div key={act.id} className="p-2.5 bg-blue-50/50 rounded-lg border border-blue-100/50">
                            <p className="text-xs font-bold text-slate-800">{act.description}</p>
                            <p className="text-[10px] text-blue-600 font-bold mt-1 uppercase">Cada {act.frequencyWeeks} semanas</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                {isAdmin && (
                  <button 
                    onClick={(e) => {
                      editAsset(selectedAsset, e as any);
                      setSelectedAsset(null);
                    }}
                    className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10"
                  >
                    <Edit2 size={18} />
                    EDITAR EQUIPO
                  </button>
                )}
                <button 
                  onClick={() => {
                    if (selectedAsset.manualUrl) {
                      const link = document.createElement('a');
                      link.href = selectedAsset.manualUrl;
                      link.download = `Manual_${selectedAsset.name.replace(/\s+/g, '_')}.pdf`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    } else {
                      alert('Este equipo no tiene un manual técnico adjunto.');
                    }
                  }}
                  className={cn(
                    "px-6 py-3 border font-bold rounded-xl flex items-center justify-center gap-2 transition-colors",
                    selectedAsset.manualUrl 
                      ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20" 
                      : "bg-white border-slate-200 text-slate-400 cursor-not-allowed"
                  )}
                >
                  <FileDown size={18} />
                  MANUAL
                </button>
                <button 
                  onClick={() => downloadAssetResume(selectedAsset)}
                  className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                >
                  <FileSpreadsheet size={18} />
                  HOJA DE VIDA
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {archiveConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setArchiveConfirmId(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8 text-left z-10"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                  <Archive size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Dar de Baja Equipo</h3>
                  <p className="text-slate-500 font-medium text-sm mt-1">
                    ¿Está seguro de dar de baja este equipo? Se moverá al módulo de Archivo y no se programarán nuevas tareas.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-8">
                <button
                  onClick={() => setArchiveConfirmId(null)}
                  className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors uppercase text-[11px] tracking-widest"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmArchive}
                  className="px-6 py-3 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20 transition-all uppercase text-[11px] tracking-widest"
                >
                  Dar de Baja
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8 text-left z-10"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Confirmar Eliminación</h3>
                  <p className="text-slate-500 font-medium text-sm mt-1">
                    ¿Está seguro de que desea eliminar este equipo permanentemente del sistema? Esta acción borrará todos sus datos y no se puede deshacer.
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
                  Eliminar Equipo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
