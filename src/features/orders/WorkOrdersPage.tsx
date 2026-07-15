import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  FileDown, 
  Calendar, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  Users,
  ChevronRight,
  TrendingUp,
  X,
  Filter,
  CheckSquare,
  Loader2,
  Edit2,
  Trash2,
  MapPin
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { WorkOrder, Asset, Technician, Location, SparePart } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Package,
  Layers,
  TrendingDown,
  ChevronDown,
} from 'lucide-react';

import { useAuthStore } from '../../store/useAuthStore';
import { useFirestoreCollection, addFirestoreDoc, updateFirestoreDoc } from '../../lib/firestoreHooks';

export default function WorkOrdersPage() {
  const { user } = useAuthStore();
  
  const { data: orders, loading: loadingOrders } = useFirestoreCollection<WorkOrder>('orders');
  const { data: assets, loading: loadingAssets } = useFirestoreCollection<Asset>('assets');
  const { data: technicians, loading: loadingTechs } = useFirestoreCollection<Technician>('users');
  const { data: locations } = useFirestoreCollection<Location>('locations');
  const { data: spareParts } = useFirestoreCollection<SparePart>('spare_parts');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(new Date().toISOString().split('T')[0]); // Use as reference for week
  const [filterType, setFilterType] = useState<'ALL' | 'WEEK'>('ALL');
  const [taskScope, setTaskScope] = useState<'ALL' | 'MINE'>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saveManagementConfirmOrder, setSaveManagementConfirmOrder] = useState<WorkOrder | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const hourlyRate = 13000; // Fixed rate of 13,000 COP per hour
  
  const [formData, setFormData] = useState({
    assetId: '',
    priority: 'MEDIA' as 'ALTA' | 'MEDIA' | 'BAJA',
    date: new Date().toISOString().split('T')[0],
    assignedTechnicians: [] as string[],
    status: 'PENDIENTE' as 'PENDIENTE' | 'EN_PROGRESO' | 'COMPLETADA',
    type: 'MAINTENANCE' as 'MAINTENANCE' | 'CALIBRATION',
    validated: false,
    extractTasks: true,
    usedParts: [] as { partId: string, partName: string, quantity: number, fullyUsed: boolean }[]
  });

  const activeAssets = useMemo(() => assets.filter(a => (a.status || 'ACTIVE') === 'ACTIVE'), [assets]);
  const activeTechs = useMemo(() => technicians.filter(t => t.status === 'ACTIVE' || t.role === 'TECHNICIAN'), [technicians]);

  const getWeekNumber = (d: Date) => {
    const year = d.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const firstSunday = new Date(firstDayOfYear);
    while (firstSunday.getDay() !== 0) {
      firstSunday.setDate(firstSunday.getDate() + 1);
    }
    
    const diff = d.getTime() - firstSunday.getTime();
    if (diff < 0) return 1;
    
    return Math.min(Math.max(Math.floor(diff / (1000 * 60 * 60 * 24 * 7)) + 1, 1), 52);
  };

  const currentWeekNumber = useMemo(() => getWeekNumber(new Date(formData.date)), [formData.date]);

  const filteredActivities = useMemo(() => {
    if (!formData.assetId) return [];
    const asset = assets.find(a => a.id === formData.assetId);
    if (!asset) return [];
    
    let acts = asset.activities;
    
    // Filtrar por tipo seleccionado
    acts = acts.filter(act => (act.type || 'MAINTENANCE') === formData.type);

    if (formData.extractTasks && !editingId) {
      // Filter activities that correspond to this week only for new orders
      return acts.filter(act => currentWeekNumber % act.frequencyWeeks === 0);
    }
    return acts;
  }, [formData.assetId, formData.extractTasks, currentWeekNumber, assets, editingId, formData.type]);

  const selectedAssetLocationId = useMemo(() => {
    return assets.find(a => a.id === formData.assetId)?.locationId;
  }, [assets, formData.assetId]);

  const techniciansInLocation = useMemo(() => {
    if (!selectedAssetLocationId) return activeTechs;
    return activeTechs.filter(t => t.locationId === selectedAssetLocationId);
  }, [activeTechs, selectedAssetLocationId]);

  // Auto-set priority based on filtered tasks
  useEffect(() => {
    if (formData.extractTasks && filteredActivities.length > 0 && !editingId) {
      const priorityMap: Record<string, number> = { 'ALTA': 3, 'MEDIA': 2, 'BAJA': 1 };
      let maxPrio: 'ALTA' | 'MEDIA' | 'BAJA' = 'BAJA';
      let maxVal = 0;
      
      filteredActivities.forEach(act => {
        const p = act.priority || 'MEDIA';
        if (priorityMap[p] > maxVal) {
          maxVal = priorityMap[p];
          maxPrio = p;
        }
      });
      
      setFormData(prev => ({ ...prev, priority: maxPrio }));
    }
  }, [filteredActivities, formData.extractTasks, editingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const asset = assets.find(a => a.id === formData.assetId);
    if (!asset) return;

    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateFirestoreDoc('orders', editingId, {
          priority: formData.priority, 
          status: formData.status, 
          type: formData.type,
          validated: formData.validated,
          assignedTechnicians: formData.assignedTechnicians,
          date: formData.date,
          weekNumber: currentWeekNumber,
          updatedAt: new Date().toISOString(),
          usedParts: formData.usedParts
        });
        setNotification('¡Orden de trabajo actualizada correctamente!');
      } else {
        // Get sequential number locally for UI, but real number should be handled by Firestore ideally.
        // For simplicity, we'll sort the current local copy of orders.
        const sortedOrders = [...orders].sort((a, b) => b.orderNumber.localeCompare(a.orderNumber));
        const lastOrder = sortedOrders[0];
        const nextNum = lastOrder ? parseInt(lastOrder.orderNumber) + 1 : 1;
        const orderNumber = nextNum.toString().padStart(5, '0');

        // Extract tasks based on frequency filter or all if selected
        const tasksToAssign = filteredActivities.map(act => ({ 
          description: act.description, 
          status: 'PENDIENTE' as const
        }));

        if (tasksToAssign.length === 0 && formData.extractTasks) {
          handleManualNotification('No hay tareas programadas para esta semana en el ciclo de este equipo. Desmarque "Extraer Orden Automática" si desea incluir todas las tareas.');
          setIsSubmitting(false);
          return;
        }

        const newOrder: any = {
          orderNumber,
          assetId: asset.id,
          assetName: asset.name,
          locationId: asset.locationId || null,
          priority: formData.priority,
          status: formData.status,
          type: formData.type,
          validated: formData.validated,
          tasks: tasksToAssign,
          assignedTechnicians: formData.assignedTechnicians,
          date: formData.date,
          startTime: '',
          endTime: '',
          pendingTasks: '',
          weekNumber: currentWeekNumber,
          year: new Date(formData.date).getFullYear(),
          createdAt: new Date().toISOString(),
          maintenanceCost: 0,
          usedParts: formData.usedParts
        };

        // Update stock for parts assigned during creation (assuming they are "reserved" or consumed-at-creation)
        // User said: "y que si se van utilizando se vaya actualizando el stock"
        // Let's deduct from stock immediately if assigned at creation.
        for (const part of formData.usedParts) {
          const sp = spareParts.find(p => p.id === part.partId);
          if (sp) {
             await updateFirestoreDoc('spare_parts', sp.id, { 
               stock: Math.max(0, sp.stock - part.quantity) 
             });
          }
        }

        await addFirestoreDoc('orders', newOrder);
        setSelectedWeek(formData.date); // Update filter to show the new order immediately
        setNotification('¡Orden de trabajo guardada correctamente!');
      }
      
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleManualNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleEdit = (order: WorkOrder) => {
    setEditingId(order.id);
    setFormData({
      assetId: order.assetId,
      priority: order.priority,
      date: order.date,
      assignedTechnicians: order.assignedTechnicians,
      status: order.status,
      type: order.type || 'MAINTENANCE',
      validated: order.validated || false,
      extractTasks: false,
      usedParts: order.usedParts || []
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      assetId: '',
      priority: 'MEDIA',
      date: new Date().toISOString().split('T')[0],
      assignedTechnicians: [],
      status: 'PENDIENTE',
      type: 'MAINTENANCE',
      validated: false,
      extractTasks: true,
      usedParts: []
    });
    setEditingId(null);
  };

  const handleUpdateTaskStatus = async (orderId: string, taskIndex: number, status: 'COMPLETADA' | 'INCOMPLETA' | 'NO_REALIZADA' | 'PENDIENTE') => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const newTasks = [...order.tasks];
    newTasks[taskIndex].status = status;
    
    // Clear note if switching back to COMPLETADA
    if (status === 'COMPLETADA') {
      newTasks[taskIndex].note = '';
    }
    
    try {
      await updateFirestoreDoc('orders', orderId, { tasks: newTasks });
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTaskNote = async (orderId: string, taskIndex: number, note: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const newTasks = [...order.tasks];
    newTasks[taskIndex].note = note;
    
    try {
      await updateFirestoreDoc('orders', orderId, { tasks: newTasks });
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTimesAndCost = async (orderId: string, startTime: string, endTime: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    let cost = 0;
    if (startTime && endTime) {
      const start = new Date(`1970-01-01T${startTime}:00`);
      const end = new Date(`1970-01-01T${endTime}:00`);
      const diffMs = end.getTime() - start.getTime();
      const diffHrs = Math.max(0, diffMs / (1000 * 60 * 60));
      const technicianCount = order.assignedTechnicians.length || 1;
      cost = diffHrs * hourlyRate * technicianCount;
    }

    try {
      await updateFirestoreDoc('orders', orderId, { 
        startTime, 
        endTime, 
        maintenanceCost: cost 
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveManagement = (order: WorkOrder) => {
    // Validation
    const allNotesPresent = order.tasks.every(t => 
      t.status === 'COMPLETADA' || (t.note && t.note.length > 5)
    );
    
    if (!order.startTime || !order.endTime) {
      handleManualNotification('Debe registrar hora de inicio y fin.');
      return;
    }

    if (!allNotesPresent) {
      handleManualNotification('Debe agregar una descripción obligatoria para las tareas no realizadas.');
      return;
    }

    setSaveManagementConfirmOrder(order);
  };

  const confirmSaveManagement = async () => {
    if (!saveManagementConfirmOrder) return;
    try {
      await updateFirestoreDoc('orders', saveManagementConfirmOrder.id, { status: 'EN_PROGRESO' });
      setNotification('¡Gestión de la orden guardada correctamente!');
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Error al guardar la gestión de la orden');
    } finally {
      setSaveManagementConfirmOrder(null);
    }
  };

  const handleCloseOrder = async (orderId: string) => {
    if (window.confirm('¿Desea cerrar y validar oficialmente esta orden de trabajo?')) {
      try {
        await updateFirestoreDoc('orders', orderId, { status: 'COMPLETADA' });
        setNotification('¡Orden de trabajo cerrada y validada correctamente!');
        setTimeout(() => setNotification(null), 3000);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const exportPDF = (order: WorkOrder) => {
    const doc = new jsPDF() as any;
    const margin = 20;
    const asset = assets.find(a => a.id === order.assetId);
    
    // Header - Professional Dark Bar
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(order.type === 'CALIBRATION' ? 'ORDEN DE CALIBRACIÓN' : 'ORDEN DE TRABAJO', margin, 28);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(order.type === 'CALIBRATION' ? 'PROTOCOLOS DE CALIBRACIÓN Y METROLOGÍA' : 'MANTENIMIENTO PREVENTIVO INDUSTRIAL', margin, 36);
    
    doc.setFontSize(14);
    doc.setFont('courier', 'bold');
    doc.text(`OT-${order.orderNumber}`, 160, 28);

    // Asset Info Section
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('1. INFORMACIÓN TÉCNICA DEL ACTIVO', margin, 60);
    doc.setLineWidth(0.5);
    doc.setDrawColor(30, 41, 59);
    doc.line(margin, 62, 190, 62);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Equipo:`, margin, 72);
    doc.setFont('helvetica', 'bold');
    doc.text(order.assetName, margin + 40, 72);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Marca / Modelo:`, margin, 80);
    doc.setFont('helvetica', 'bold');
    doc.text(`${asset?.brand || 'N/A'} / ${asset?.model || 'N/A'}`, margin + 40, 80);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Serie / Inventario:`, margin, 88);
    doc.setFont('helvetica', 'bold');
    doc.text(asset?.institutionalInventoryNumber || asset?.serialNumber || 'S/N', margin + 40, 88);

    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha Programada:`, 120, 72);
    doc.setFont('helvetica', 'bold');
    doc.text(order.date, 160, 72);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Tiempos:`, 120, 80);
    doc.setFont('helvetica', 'bold');
    doc.text(`${order.startTime || '--:--'} a ${order.endTime || '--:--'}`, 160, 80);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Costo Manto:`, 120, 88);
    doc.setFont('helvetica', 'bold');
    doc.text(`$${Math.round(order.maintenanceCost || 0).toLocaleString()}`, 160, 88);

    doc.setFont('helvetica', 'normal');
    doc.text(`Tipo OT:`, margin, 96);
    doc.setFont('helvetica', 'bold');
    doc.text(order.type === 'CALIBRATION' ? 'CALIBRACIÓN' : 'MANTENIMIENTO', margin + 40, 96);

    doc.setFont('helvetica', 'normal');
    doc.text(`Validada:`, 120, 96);
    doc.setFont('helvetica', 'bold');
    if (order.validated) {
      doc.setTextColor(22, 163, 74);
      doc.text('SÍ (VALIDA)', 140, 96);
    } else {
      doc.setTextColor(220, 38, 38);
      doc.text('NO (PENDIENTE)', 140, 96);
    }
    doc.setTextColor(30, 41, 59);

    if (asset?.imageUrl) {
      try {
        doc.addImage(asset.imageUrl, 'JPEG', 160, 48, 30, 30);
      } catch (e) {}
    }

    // Technicians Section
    doc.setFontSize(12);
    doc.text('2. PERSONAL ASIGNADO', margin, 110);
    doc.line(margin, 112, 190, 112);
    
    const names = technicians
      .filter(t => order.assignedTechnicians.includes(t.id))
      .map(t => `${t.firstName} ${t.lastName}`)
      .join(', ') || 'Sin técnicos asignados';
      
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(names, margin, 115);

    // Spare Parts Section (PDF)
    let yPos = 130;
    if (order.usedParts && order.usedParts.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('3. REPUESTOS Y MATERIALES', margin, 130);
      doc.line(margin, 132, 190, 132);
      
      autoTable(doc, {
        startY: 135,
        head: [['REPUESTO', 'CANTIDAD', 'ESTADO DE USO']],
        body: order.usedParts.map(up => [
          up.partName,
          up.quantity,
          up.fullyUsed ? 'USO TOTAL' : 'USO PARCIAL'
        ]),
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 9 }
      });
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // Tasks Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(order.usedParts && order.usedParts.length > 0 ? '4. PROTOCOLO DE ACTIVIDADES' : '3. PROTOCOLO DE ACTIVIDADES', margin, yPos);
    autoTable(doc, {
      startY: yPos + 5,
      head: [['#', 'DESCRIPCIÓN DE LA ACTIVIDAD', 'ESTADO', 'NOTAS']],
      body: order.tasks.map((t, i) => [
        i + 1, 
        t.description, 
        t.status.replace('_', ' '),
        t.note || 'N/A'
      ]),
      theme: 'grid',
      headStyles: { 
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 9,
        cellPadding: 4
      },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 'auto' }
      }
    });

    const assignedNames = technicians
      .filter(t => order.assignedTechnicians.includes(t.id))
      .map(t => `${t.firstName} ${t.lastName}`)
      .join(', ') || 'Sin técnicos asignados';
      
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const finalTableY = (doc as any).lastAutoTable.finalY || 135;
    doc.text(`Técnico(s) Asignado(s): ${assignedNames}`, margin, finalTableY + 15);

    if (order.validated) {
      doc.setFontSize(8);
      doc.setTextColor(22, 163, 74);
      doc.setFont('helvetica', 'bold');
      doc.text('ESTA ORDEN HA SIDO VALIDADA POR LA ADMINISTRACIÓN', 105, finalTableY + 25, { align: 'center' });
    }

    doc.save(`OT_${order.orderNumber}_${order.assetName.replace(/\s+/g, '_')}.pdf`);
  };

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      // Primary sort by date (descending)
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateB !== dateA) return dateB - dateA;
      // Secondary sort by order number (descending)
      return b.orderNumber.localeCompare(a.orderNumber);
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = sortedOrders;

    // Task scope filter (Technician specific)
    if (taskScope === 'MINE' && user?.id) {
      result = result.filter(o => o.assignedTechnicians.includes(user.id));
    }

    // Temporal filter
    if (filterType === 'WEEK' && selectedWeek) {
      result = result.filter(o => {
        const orderWeek = o.weekNumber;
        const filterWeek = getWeekNumber(new Date(selectedWeek));
        const filterYear = new Date(selectedWeek).getFullYear();
        return orderWeek === filterWeek && o.year === filterYear;
      });
    }
    
    return result;
  }, [sortedOrders, selectedWeek, filterType, taskScope, user?.id]);

  if (loadingOrders || loadingAssets || loadingTechs) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-slate-500 font-medium mt-4">Cargando órdenes de trabajo...</p>
      </div>
    );
  }

  const deleteOrder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await updateFirestoreDoc('orders', deleteConfirmId, { status: 'ARCHIVED' });
      setNotification('Orden de trabajo eliminada (archivada).');
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Error al eliminar la orden de trabajo');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  const canEdit = (order: WorkOrder) => {
    if (isAdmin) return true;
    return order.assignedTechnicians.includes(user?.id || '');
  };

  return (
    <div className="space-y-8 pb-20 text-left relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-bold text-sm tracking-wide border border-emerald-500/20"
          >
            <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
              <CheckCircle2 size={14} />
            </div>
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
             <ClipboardList className="text-blue-600" size={32} />
             Gestión de Órdenes
          </h1>
          <p className="text-slate-500 mt-1">Generación de mantenimiento preventivo basado en ciclos semanales.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {user?.role === 'TECHNICIAN' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-1.5 flex shadow-sm">
              <button 
                onClick={() => setTaskScope('ALL')}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  taskScope === 'ALL' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Todas las OT
              </button>
              <button 
                onClick={() => setTaskScope('MINE')}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  taskScope === 'MINE' ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Mis Tareas
              </button>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl p-1.5 flex shadow-sm">
            <button 
              onClick={() => setFilterType('ALL')}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                filterType === 'ALL' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Cualquier Fecha
            </button>
            <button 
              onClick={() => setFilterType('WEEK')}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                filterType === 'WEEK' ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Semana Específica
            </button>
          </div>

          {filterType === 'WEEK' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-1.5 flex shadow-sm animate-in fade-in slide-in-from-right-2">
               <div className="px-4 py-2 flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest border-r border-slate-100">
                 <Calendar size={14} />
               </div>
               <input 
                 type="date" 
                 className="bg-transparent px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none"
                 value={selectedWeek}
                 onChange={(e) => setSelectedWeek(e.target.value)}
               />
            </div>
          )}
          
          {user?.role === 'ADMIN' && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-blue-600/20 active:scale-95 whitespace-nowrap"
            >
              <Plus size={20} />
              NUEVA ORDEN
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-16">OT #</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Equipo</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ubicación</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Programación</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                {user?.role === 'ADMIN' && (
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Validar</th>
                )}
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Costo Manto</th>
                <th className="px-6 py-4 w-10"></th>
              </tr>
            </thead>
            {filteredOrders.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={user?.role === 'ADMIN' ? 7 : 6} className="py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ClipboardList className="text-slate-200" size={32} />
                    </div>
                    <p className="text-slate-400 font-medium italic">No hay órdenes de trabajo para esta semana.</p>
                  </td>
                </tr>
              </tbody>
            ) : (
              filteredOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                return (
                  <tbody key={order.id} className="border-b border-slate-100 last:border-0">
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      className={cn(
                        "group cursor-pointer transition-colors hover:bg-slate-50/50",
                        isExpanded ? "bg-blue-50/20" : "",
                        order.status === 'COMPLETADA' ? "bg-emerald-100/40" : "",
                        order.assignedTechnicians.includes(user?.id || '') ? "border-l-4 border-l-blue-600" : ""
                      )}
                    >
                          <td className="px-6 py-5 text-center">
                            <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-1 rounded-md uppercase tracking-tighter">
                              {order.orderNumber}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter",
                                  order.type === 'CALIBRATION' ? "bg-violet-600 text-white" : "bg-slate-200 text-slate-600"
                                )}>
                                  {order.type === 'CALIBRATION' ? 'CALIBRACIÓN' : 'MANTO'}
                                </span>
                                <span className="text-sm font-bold text-slate-900">{order.assetName}</span>
                              </div>
                              <span className={cn(
                                "text-[9px] font-bold uppercase tracking-widest mt-0.5",
                                order.priority === 'ALTA' ? "text-rose-600" :
                                order.priority === 'MEDIA' ? "text-amber-600" : "text-blue-600"
                              )}>
                                {order.priority} PRIORIDAD
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-1.5">
                              <MapPin size={12} className="text-slate-400" />
                              <span className="text-xs font-bold text-slate-600">
                                {locations.find(l => l.id === order.locationId)?.place || 'S/A'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                              <Calendar size={12} className="text-slate-400" />
                              {order.date} (S{order.weekNumber})
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                              order.status === 'COMPLETADA' ? "bg-emerald-100 text-emerald-700" :
                              order.status === 'EN_PROGRESO' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                            )}>
                              {order.status.replace('_', ' ')}
                            </span>
                          </td>
                          {user?.role === 'ADMIN' && (
                            <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={async () => {
                                  try {
                                    await updateFirestoreDoc('orders', order.id, { validated: !order.validated });
                                    setNotification(order.validated ? 'Validación removida' : '¡Orden validada correctamente!');
                                    setTimeout(() => setNotification(null), 3000);
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }}
                                className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center transition-all border shadow-sm",
                                  order.validated 
                                    ? "bg-emerald-600 border-emerald-600 text-white" 
                                    : "bg-white border-slate-200 text-slate-300 hover:text-emerald-600 hover:border-emerald-200"
                                )}
                              >
                                <CheckSquare size={16} />
                              </button>
                            </td>
                          )}
                          <td className="px-6 py-5 text-right">
                            <span className="text-sm font-black text-slate-900">
                              ${Math.round(order.maintenanceCost || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button 
                                onClick={() => exportPDF(order)}
                                className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                title="Exportar PDF"
                              >
                                <FileDown size={18} />
                              </button>
                              {canEdit(order) && (
                                <button 
                                  onClick={() => handleEdit(order)}
                                  className="p-2 text-slate-400 hover:text-amber-600 transition-colors"
                                  title="Editar / Gestionar"
                                >
                                  <Edit2 size={18} />
                                </button>
                              )}
                              {isAdmin && (
                                <button 
                                  onClick={(e) => deleteOrder(order.id, e)}
                                  className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          </td>
                    </motion.tr>

                    {/* Expanded Detail View */}
                    <AnimatePresence>
                      {isExpanded && (
                        <tr>
                          <td colSpan={user?.role === 'ADMIN' ? 7 : 6} className="p-0 border-b border-slate-100 bg-slate-50/30">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-12">
                              <div className="md:col-span-2 space-y-8 text-left">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gestión de Tareas</h4>
                                    <div className="flex items-center gap-6">
                                      <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Inicio:</span>
                                        <input 
                                          type="time" 
                                          className="text-xs bg-white border border-slate-200 outline-none rounded-lg px-2 py-1 shadow-sm font-bold text-slate-700"
                                          value={order.startTime || ''}
                                          onChange={(e) => handleUpdateTimesAndCost(order.id, e.target.value, order.endTime || '')}
                                        />
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Fin:</span>
                                        <input 
                                          type="time" 
                                          className="text-xs bg-white border border-slate-200 outline-none rounded-lg px-2 py-1 shadow-sm font-bold text-slate-700"
                                          value={order.endTime || ''}
                                          onChange={(e) => handleUpdateTimesAndCost(order.id, order.startTime || '', e.target.value)}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    {order.tasks.map((task, idx) => (
                                      <div 
                                        key={idx}
                                        className="flex flex-col gap-3 p-4 rounded-2xl border bg-white border-slate-100 shadow-sm transition-all hover:shadow-md"
                                      >
                                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                                          <span className="text-xs font-bold text-slate-700 flex-1">{task.description}</span>
                                          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                                            {[
                                              { id: 'COMPLETADA', label: 'C', color: 'bg-emerald-600', full: 'Completada' },
                                              { id: 'INCOMPLETA', label: 'I', color: 'bg-amber-500', full: 'Incompleta' },
                                              { id: 'NO_REALIZADA', label: 'N', color: 'bg-rose-600', full: 'No Realizada' },
                                              { id: 'PENDIENTE', label: 'P', color: 'bg-slate-400', full: 'Pendiente' }
                                            ].map((status) => (
                                              <button
                                                key={status.id}
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleUpdateTaskStatus(order.id, idx, status.id as any);
                                                }}
                                                title={status.full}
                                                className={cn(
                                                  "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black text-white transition-all transform active:scale-90",
                                                  task.status === status.id ? status.color : "text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                                                )}
                                              >
                                                {status.label}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                        
                                        {task.status !== 'COMPLETADA' && (
                                          <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <label className="text-[9px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1 ml-1">
                                              <AlertCircle size={10} />
                                              Justificación obligatoria
                                            </label>
                                            <textarea
                                              placeholder="Describa el motivo..."
                                              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-medium text-slate-600 outline-none focus:border-rose-400 focus:bg-white transition-all"
                                              value={task.note || ''}
                                              onChange={(e) => handleUpdateTaskNote(order.id, idx, e.target.value)}
                                              rows={1}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>

                                  {/* Section Repuestos Utilizados */}
                                  <div className="space-y-4 pt-6 border-t border-slate-100">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Layers size={14} className="text-blue-600" />
                                        Repuestos Utilizados
                                      </h4>
                                      <div className="flex gap-2">
                                        <select 
                                          className="text-[10px] bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-bold outline-none cursor-pointer focus:ring-2 focus:ring-blue-600/10 transition-all shadow-sm"
                                          onChange={async (e) => {
                                            const partId = e.target.value;
                                            if (!partId) return;
                                            const sp = spareParts.find(p => p.id === partId);
                                            if (!sp) return;
                                            
                                            const currentParts = order.usedParts || [];
                                            const existing = currentParts.find(p => p.partId === partId);
                                            
                                            if (existing) {
                                              handleManualNotification('El repuesto ya está en la lista.');
                                              return;
                                            }

                                            const newParts = [...currentParts, { partId, partName: sp.name, quantity: 1, fullyUsed: true }];
                                            await updateFirestoreDoc('orders', order.id, { usedParts: newParts });
                                            await updateFirestoreDoc('spare_parts', sp.id, { stock: Math.max(0, sp.stock - 1) });
                                            e.target.value = '';
                                          }}
                                        >
                                          <option value="">+ Agregar Repuesto</option>
                                          {spareParts.filter(sp => sp.stock > 0).map(sp => (
                                            <option key={sp.id} value={sp.id}>{sp.name} (Stock: {sp.stock})</option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>

                                    {(!order.usedParts || order.usedParts.length === 0) ? (
                                      <div className="py-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                        <p className="text-[10px] text-slate-400 italic">No se han relacionado repuestos a esta orden.</p>
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {order.usedParts.map((up, uidx) => (
                                          <div key={uidx} className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-all group">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center text-blue-600">
                                                  <Package size={12} />
                                                </div>
                                                <span className="text-xs font-bold text-slate-700">{up.partName}</span>
                                              </div>
                                              <button 
                                                onClick={async () => {
                                                  const newParts = order.usedParts!.filter((_, i) => i !== uidx);
                                                  await updateFirestoreDoc('orders', order.id, { usedParts: newParts });
                                                  const sp = spareParts.find(p => p.id === up.partId);
                                                  if (sp) await updateFirestoreDoc('spare_parts', sp.id, { stock: sp.stock + up.quantity });
                                                }}
                                                className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                              <div className="flex items-center gap-3">
                                                <button 
                                                  onClick={async () => {
                                                    if (up.quantity <= 1) return;
                                                    const newParts = [...order.usedParts!];
                                                    newParts[uidx].quantity -= 1;
                                                    await updateFirestoreDoc('orders', order.id, { usedParts: newParts });
                                                    const sp = spareParts.find(p => p.id === up.partId);
                                                    if (sp) await updateFirestoreDoc('spare_parts', sp.id, { stock: sp.stock + 1 });
                                                  }}
                                                  className="w-6 h-6 bg-slate-100 hover:bg-slate-200 rounded flex items-center justify-center text-slate-600 transition-colors"
                                                >-</button>
                                                <span className="text-sm font-black text-slate-900 w-4 text-center">{up.quantity}</span>
                                                <button 
                                                  onClick={async () => {
                                                    const sp = spareParts.find(p => p.id === up.partId);
                                                    if (!sp || sp.stock <= 0) return;
                                                    const newParts = [...order.usedParts!];
                                                    newParts[uidx].quantity += 1;
                                                    await updateFirestoreDoc('orders', order.id, { usedParts: newParts });
                                                    await updateFirestoreDoc('spare_parts', sp.id, { stock: sp.stock - 1 });
                                                  }}
                                                  className="w-6 h-6 bg-slate-100 hover:bg-slate-200 rounded flex items-center justify-center text-slate-600 transition-colors"
                                                >+</button>
                                              </div>
                                              <button 
                                                onClick={async () => {
                                                  const newParts = [...order.usedParts!];
                                                  newParts[uidx].fullyUsed = !newParts[uidx].fullyUsed;
                                                  await updateFirestoreDoc('orders', order.id, { usedParts: newParts });
                                                }}
                                                className={cn(
                                                  "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all",
                                                  up.fullyUsed ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20" : "bg-amber-50 text-amber-600 ring-1 ring-amber-500/20"
                                                )}
                                              >
                                                {up.fullyUsed ? 'Uso Total' : 'Uso Parcial'}
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-8 flex flex-col h-full border-l border-slate-200 pl-8 text-left">
                                  <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Personal Responsable</h4>
                                    <div className="flex flex-wrap gap-2">
                                      {order.assignedTechnicians.map(techId => {
                                        const tech = technicians.find(t => t.id === techId);
                                        if (!tech) return null;
                                        return (
                                          <div key={techId} className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                                              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-white font-black">
                                                {tech.firstName[0]}
                                              </div>
                                              <span className="text-[10px] font-bold text-slate-700">{tech.firstName} {tech.lastName}</span>
                                            </div>
                                            <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest ml-7">
                                              {tech.area}
                                            </span>
                                          </div>
                                        );
                                      })}
                                      {order.assignedTechnicians.length === 0 && (
                                         <div className="text-[10px] text-slate-400 italic">No hay técnicos asignados</div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-auto flex flex-col gap-3">
                                    {user?.role === 'ADMIN' && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleEdit(order); }}
                                        className="w-full py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-50 transition-all shadow-sm active:scale-95 text-xs uppercase tracking-widest"
                                      >
                                        <Plus size={16} className="rotate-45" />
                                        Editar Info
                                      </button>
                                    )}
                                    
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleSaveManagement(order); }}
                                      className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/10 active:scale-95 text-xs uppercase tracking-widest"
                                    >
                                      <CheckSquare size={18} />
                                      Guardar Gestión
                                    </button>

                                    <button 
                                      onClick={(e) => { e.stopPropagation(); exportPDF(order); }}
                                      className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 active:scale-95 text-xs uppercase tracking-widest"
                                    >
                                      <FileDown size={18} />
                                      Exportar PDF
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </tbody>
                );
              })
            )}
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 rounded-xl text-white">
                    <ClipboardList size={20} />
                  </div>
                  <h3 className="font-black text-slate-900 tracking-tight uppercase">
                    {editingId ? 'Editar Orden de Trabajo' : 'Nueva Orden de Trabajo'}
                  </h3>
                </div>
                <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Orden</label>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, type: 'MAINTENANCE'})}
                      className={cn(
                        "flex-1 py-2.5 rounded-xl border text-[10px] font-black transition-all uppercase tracking-widest",
                        formData.type === 'MAINTENANCE' ? "bg-slate-900 text-white shadow-lg" : "bg-white text-slate-400 border-slate-200"
                      )}
                    >
                      Mantenimiento
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, type: 'CALIBRATION'})}
                      className={cn(
                        "flex-1 py-2.5 rounded-xl border text-[10px] font-black transition-all uppercase tracking-widest",
                        formData.type === 'CALIBRATION' ? "bg-violet-600 text-white shadow-xl shadow-violet-500/20" : "bg-white text-slate-400 border-slate-200"
                      )}
                    >
                      Calibración
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {user?.role === 'ADMIN' && (
                    <div className="md:col-span-2 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
                          <CheckSquare size={18} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest leading-none">Validación de Administración</p>
                          <p className="text-[9px] font-bold text-emerald-600 uppercase mt-1">La orden validada se marca en verde en el cronograma</p>
                        </div>
                      </div>
                      <input 
                        type="checkbox"
                        className="w-5 h-5 text-emerald-600 rounded-lg border-emerald-200 focus:ring-emerald-500"
                        checked={formData.validated}
                        onChange={(e) => setFormData({...formData, validated: e.target.checked})}
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seleccionar Equipo</label>
                    <div className="relative">
                      <select 
                        required
                        disabled={!!editingId}
                        className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all text-sm font-bold appearance-none disabled:opacity-60 disabled:bg-slate-100"
                        value={formData.assetId}
                        onChange={(e) => setFormData({...formData, assetId: e.target.value})}
                      >
                        <option value="">Seleccione un activo...</option>
                        {activeAssets.map(a => (
                          <option key={a.id} value={a.id}>{a.name} ({a.serialNumber})</option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronRight size={16} className="rotate-90" />
                      </div>
                    </div>
                  </div>
                  {!editingId && (
                    <div className="space-y-1.5 flex flex-col justify-end">
                      <div 
                        onClick={() => setFormData({...formData, extractTasks: !formData.extractTasks})}
                        className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        <div className={cn(
                          "w-5 h-5 rounded flex items-center justify-center transition-colors",
                          formData.extractTasks ? "bg-blue-600 text-white" : "border-2 border-slate-300"
                        )}>
                          {formData.extractTasks && <CheckCircle2 size={12} />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">Extraer Orden Automática</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase">Basado en frecuencia e intervención</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {editingId && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado de la Orden</label>
                      <select
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all text-sm font-bold appearance-none"
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                      >
                        <option value="PENDIENTE">PENDIENTE</option>
                        <option value="EN_PROGRESO">EN PROGRESO</option>
                        <option value="COMPLETADA">COMPLETADA</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Intervención</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all text-sm font-bold"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Semana Detectada</label>
                    <div className="flex items-center gap-3 w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-500">
                      <Calendar size={14} className="text-blue-500" />
                      Semana {currentWeekNumber} - {new Date(formData.date).getFullYear()}
                    </div>
                  </div>
                </div>

                {formData.assetId && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-2xl"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-slate-900">
                        <TrendingUp size={14} className="text-blue-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Tareas {formData.extractTasks ? 'Filtradas por Ciclo' : 'Totales del Activo'}</span>
                      </div>
                      <span className="text-[9px] font-bold bg-white px-2 py-0.5 rounded text-slate-500 border border-slate-200">
                        {filteredActivities.length} ACTIVIDADES
                      </span>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {filteredActivities.length === 0 ? (
                        <div className="p-4 text-center border-2 border-dashed border-slate-200 rounded-xl">
                          <AlertCircle size={20} className="mx-auto mb-2 text-amber-500" />
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                            No hay tareas programadas para la semana {currentWeekNumber}
                          </p>
                          <p className="text-[9px] text-slate-400 mt-2">
                            Desactive "Extraer Orden Automática" para incluir todas las tareas del equipo manualmente.
                          </p>
                        </div>
                      ) : (
                        filteredActivities.map((act, i) => (
                          <div key={i} className="flex items-center gap-3 text-xs bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                            <CheckSquare size={14} className="text-blue-500" />
                            <span className="font-bold text-slate-700 flex-1 truncate">{act.description}</span>
                            <div className="flex flex-col items-end">
                               <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">Ciclo</span>
                               <span className="text-[8px] font-bold text-slate-400 uppercase">{act.frequencyWeeks} Semanas</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prioridad</label>
                    <div className="flex gap-2">
                       {['BAJA', 'MEDIA', 'ALTA'].map((p) => (
                         <button
                           key={p}
                           type="button"
                           onClick={() => setFormData({...formData, priority: p as any})}
                           className={cn(
                             "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-tight border transition-all",
                             formData.priority === p 
                               ? "bg-slate-900 text-white border-slate-900 shadow-lg" 
                               : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50 font-bold"
                           )}
                         >
                           {p}
                         </button>
                       ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <Users size={12} className="text-blue-600" />
                      Asignar Personal {selectedAssetLocationId && "(Filtrados por Sede)"}
                    </label>
                    <div className="flex flex-wrap gap-2 overflow-y-auto max-h-32 p-1">
                      {techniciansInLocation.map(tech => (
                        <button
                          key={tech.id}
                          type="button"
                          onClick={() => {
                            const current = formData.assignedTechnicians;
                            if (current.includes(tech.id)) {
                              setFormData({...formData, assignedTechnicians: current.filter(id => id !== tech.id)});
                            } else {
                              setFormData({...formData, assignedTechnicians: [...current, tech.id]});
                            }
                          }}
                          className={cn(
                            "px-3 py-2 rounded-xl text-[10px] font-bold transition-all border flex flex-col items-start gap-0.5 min-w-[120px]",
                            formData.assignedTechnicians.includes(tech.id)
                              ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20"
                              : "bg-white text-slate-600 border-slate-100 hover:border-blue-400 hover:bg-blue-50/30"
                          )}
                        >
                          <span className="truncate w-full text-left">{tech.firstName} {tech.lastName}</span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter",
                            formData.assignedTechnicians.includes(tech.id) 
                              ? "bg-white/20 text-white" 
                              : "bg-blue-50 text-blue-600"
                          )}>
                            {tech.area}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <Layers size={12} className="text-blue-600" />
                      Repuestos Sugeridos (Opcional)
                    </label>
                    <div className="flex gap-2">
                       <select 
                         className="text-[10px] bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold outline-none cursor-pointer"
                         onChange={(e) => {
                           const partId = e.target.value;
                           if (!partId) return;
                           const sp = spareParts.find(p => p.id === partId);
                           if (!sp) return;
                           
                           const existing = formData.usedParts.find(p => p.partId === partId);
                           if (existing) {
                             handleManualNotification('El repuesto ya está en la lista.');
                             return;
                           }
                           
                           setFormData({
                             ...formData,
                             usedParts: [...formData.usedParts, { partId, partName: sp.name, quantity: 1, fullyUsed: true }]
                           });
                           e.target.value = '';
                         }}
                       >
                         <option value="">+ Vincular Repuesto</option>
                         {spareParts.filter(sp => sp.stock > 0).map(sp => (
                           <option key={sp.id} value={sp.id}>{sp.name} ({sp.stock} disp.)</option>
                         ))}
                       </select>
                    </div>
                  </div>

                  {formData.usedParts.length === 0 ? (
                    <div className="p-3 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                       <span className="text-[9px] font-bold text-slate-400 uppercase">Sin repuestos vinculados inicialmente</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {formData.usedParts.map((up, uidx) => (
                        <div key={uidx} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-2 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-700 truncate w-4/5">{up.partName}</span>
                            <button 
                              type="button"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  usedParts: formData.usedParts.filter((_, i) => i !== uidx)
                                });
                              }}
                              className="text-rose-500 hover:text-rose-700"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                               <button 
                                 type="button"
                                 onClick={() => {
                                   if (up.quantity <= 1) return;
                                   const newParts = [...formData.usedParts];
                                   newParts[uidx].quantity -= 1;
                                   setFormData({...formData, usedParts: newParts});
                                 }}
                                 className="w-5 h-5 bg-slate-100 rounded flex items-center justify-center text-slate-500"
                               >-</button>
                               <span className="text-[10px] font-black">{up.quantity}</span>
                               <button 
                                 type="button"
                                 onClick={() => {
                                   const sp = spareParts.find(p => p.id === up.partId);
                                   if (!sp || sp.stock <= up.quantity) return;
                                   const newParts = [...formData.usedParts];
                                   newParts[uidx].quantity += 1;
                                   setFormData({...formData, usedParts: newParts});
                                 }}
                                 className="w-5 h-5 bg-slate-100 rounded flex items-center justify-center text-slate-500"
                               >+</button>
                            </div>
                            <span className="text-[8px] font-black text-blue-600 uppercase">Reserva</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="submit"
                    disabled={isSubmitting || !formData.assetId || (!editingId && formData.extractTasks && filteredActivities.length === 0)}
                    className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98] uppercase tracking-widest text-xs disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                    {editingId ? 'Actualizar Orden' : 'Generar Orden de Trabajo'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
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
                    ¿Está seguro de que desea eliminar esta orden de trabajo? Esta acción se moverá al archivo de seguridad.
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
                  Eliminar Orden
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {saveManagementConfirmOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSaveManagementConfirmOrder(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8 text-left z-10"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <CheckSquare size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Guardar Gestión</h3>
                  <p className="text-slate-500 font-medium text-sm mt-1">
                    ¿Está seguro de que desea guardar la gestión de esta orden? Se registrarán las tareas completadas y el costo de mantenimiento.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-8">
                <button
                  onClick={() => setSaveManagementConfirmOrder(null)}
                  className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors uppercase text-[11px] tracking-widest"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmSaveManagement}
                  className="px-6 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all uppercase text-[11px] tracking-widest"
                >
                  Confirmar Guardar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
