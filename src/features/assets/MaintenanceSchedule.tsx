import React, { useMemo, useState } from 'react';
import { 
  Calendar, 
  Search, 
  Package,
  Wrench,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { Asset, WorkOrder, User } from '../../types';
import { useFirestoreCollection } from '../../lib/firestoreHooks';

export default function MaintenanceSchedule() {
  const { data: assets, loading: loadingAssets } = useFirestoreCollection<Asset>('assets');
  const { data: orders, loading: loadingOrders } = useFirestoreCollection<WorkOrder>('orders');
  const { data: users, loading: loadingUsers } = useFirestoreCollection<User>('users');
  
  const [searchTerm, setSearchTerm] = useState('');

  const technicians = useMemo(() => 
    users.filter(u => u.role === 'TECHNICIAN' || (u as any).area), 
  [users]);

  const activeAssets = useMemo(() => 
    assets.filter(a => (a.status || 'ACTIVE') === 'ACTIVE'),
    [assets]
  );

  const loading = loadingAssets || loadingOrders || loadingUsers;

  // 54 weeks grid logic
  const weeks = Array.from({ length: 54 }, (_, i) => i + 1);
  
  const getWeekDateRange = (weekNum: number) => {
    const year = new Date().getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const daysOffset = (weekNum - 1) * 7;
    
    const startDate = new Date(firstDayOfYear);
    startDate.setDate(firstDayOfYear.getDate() + daysOffset);
    
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${startDate.toLocaleDateString('es-ES', options)} - ${endDate.toLocaleDateString('es-ES', options)}`;
  };

  const scheduledTasks = useMemo(() => {
    const tasks: { assetId: string, assetName: string, taskDescription: string, frequency: number, scheduledWeeks: number[], priority?: 'ALTA' | 'MEDIA' | 'BAJA' }[] = [];
    
    activeAssets.forEach(asset => {
      asset.activities.forEach(activity => {
        if (
          asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          activity.description.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          const scheduledWeeks = [];
          for (let i = activity.frequencyWeeks; i <= 54; i += activity.frequencyWeeks) {
            scheduledWeeks.push(i);
          }
          tasks.push({
            assetId: asset.id,
            assetName: asset.name,
            taskDescription: activity.description,
            frequency: activity.frequencyWeeks,
            scheduledWeeks,
            priority: activity.priority || 'MEDIA'
          });
        }
      });
    });
    
    return tasks;
  }, [activeAssets, searchTerm]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-slate-500 font-medium mt-4">Sincronizando cronograma...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden flex flex-col h-[600px] text-left">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/20">
            <Calendar size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Cronograma de Mantenimiento Anual</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Planificación de 54 Semanas</p>
          </div>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Filtrar por equipo o tarea..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Grid View */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[2000px]">
          {/* Timeline Header */}
          <div className="sticky top-0 z-20 bg-white border-b border-slate-100 flex shadow-sm">
            <div className="w-80 shrink-0 p-4 border-r border-slate-100 bg-slate-50/50">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Equipo / Actividad</span>
            </div>
            {weeks.map(week => (
              <div key={week} className="w-20 shrink-0 border-r border-slate-100 flex flex-col items-center justify-center p-2 group hover:bg-blue-50 transition-colors">
                <span className="text-[10px] font-black text-slate-900">SEM {week}</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase whitespace-nowrap mt-0.5">{getWeekDateRange(week)}</span>
              </div>
            ))}
          </div>

          {/* Table Body */}
          <div className="divide-y divide-slate-50">
            {scheduledTasks.length === 0 ? (
              <div className="p-20 text-center">
                <Clock size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-400 font-medium italic">No hay tareas programadas para mostrar.</p>
              </div>
            ) : (
              scheduledTasks.map((task, idx) => (
                <div key={idx} className="flex hover:bg-slate-50/50 transition-colors group">
                  <div className="w-80 shrink-0 p-4 border-r border-slate-100 flex flex-col justify-center">
                    <p className="text-xs font-black text-slate-900 group-hover:text-blue-600 transition-colors">{task.assetName}</p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5 line-clamp-1">{task.taskDescription}</p>
                    <div className="mt-2 flex items-center gap-2">
                       <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">CADA {task.frequency} SEM</span>
                    </div>
                  </div>
                  
                  {weeks.map(week => {
                    const isScheduled = task.scheduledWeeks.includes(week);
                    const year = new Date().getFullYear();
                    const existingOrder = orders.find(o => 
                      o.assetId === task.assetId && 
                      o.weekNumber === week && 
                      o.year === year
                    );

                    return (
                      <div 
                        key={week} 
                        className={cn(
                          "w-20 shrink-0 border-r border-slate-100 flex items-center justify-center p-2 relative",
                          isScheduled ? "bg-blue-50/30" : "",
                          existingOrder ? "bg-indigo-50/50" : ""
                        )}
                      >
                        {isScheduled && (
                          <motion.div 
                            whileHover={{ scale: 1.1 }}
                            className={cn(
                              "w-full h-8 rounded-lg shadow-lg flex items-center justify-center text-white transition-all cursor-pointer group/task",
                              existingOrder?.status === 'COMPLETADA' ? "bg-emerald-600 shadow-emerald-500/20" :
                              existingOrder ? "bg-amber-500 shadow-amber-500/20 border-2 border-white/20" :
                              task.priority === 'ALTA' ? "bg-rose-600 shadow-rose-500/20" :
                              task.priority === 'MEDIA' ? "bg-amber-500 shadow-amber-500/20" :
                              "bg-blue-600 shadow-blue-500/20"
                            )}
                          >
                            {existingOrder?.status === 'COMPLETADA' ? <CheckCircle2 size={12} /> : <Wrench size={12} />}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-[9px] font-bold rounded-xl opacity-0 group-hover/task:opacity-100 transition-opacity whitespace-nowrap z-30 pointer-events-none shadow-2xl border border-slate-700">
                              {existingOrder ? (
                                <div className="flex flex-col gap-1.5 min-w-[140px]">
                                  <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-1">
                                    <span>OT #{existingOrder.orderNumber}</span>
                                    <span className={cn(
                                      "text-[7px] font-black uppercase px-1 rounded",
                                      existingOrder.status === 'COMPLETADA' ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-300"
                                    )}>
                                      {existingOrder.status === 'COMPLETADA' ? 'CERRADA' : 'PENDIENTE'}
                                    </span>
                                  </div>
                                  
                                  <div className="space-y-1">
                                    <p className="text-[7px] text-slate-400 uppercase tracking-tighter">Responsables:</p>
                                    {existingOrder.assignedTechnicians.length > 0 ? (
                                      existingOrder.assignedTechnicians.map(techId => {
                                        const tech = technicians.find(t => t.id === techId);
                                        return (
                                          <div key={techId} className="flex flex-col">
                                            <span className="text-white">{tech ? `${tech.firstName} ${tech.lastName}` : 'Desconocido'}</span>
                                            {tech && <span className="text-blue-400 text-[7px] font-black uppercase tracking-widest">{tech.area}</span>}
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <span className="text-rose-400 animate-pulse font-black uppercase text-[8px] flex items-center gap-1">
                                        <AlertCircle size={8} /> SIN TÉCNICO ASIGNADO
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="max-w-[200px] whitespace-normal">
                                  {task.taskDescription}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer / Stats */}
      <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-6 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-rose-600"></div>
            <span>Alta Prioridad</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <span>Media Prioridad</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-600"></div>
            <span>Baja Prioridad</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
            <span>OT Generada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-600"></div>
            <span>Completada</span>
          </div>
        </div>
        <p>{scheduledTasks.length} Tareas Totales Registradas</p>
      </div>
    </div>
  );
}
