import { useEffect, useState, useRef, useMemo } from 'react';
import { 
  Wrench, 
  Users, 
  Activity, 
  TrendingUp,
  Clock,
  AlertTriangle,
  FileSearch,
  Archive,
  ArrowRight,
  Package,
  X,
  ClipboardCheck,
  DollarSign,
  Timer,
  FileDown,
  Trash2,
  RefreshCcw,
  Loader2
} from 'lucide-react';
import { MaintenanceStats, Asset, WorkOrder, Technician, User } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import SmartAssistant from '../../components/SmartAssistant';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  LabelList
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useFirestoreCollection } from '../../lib/firestoreHooks';
import { orderBy } from 'firebase/firestore';

export default function Dashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null);
  
  // Real-time data from Firestore
  const { data: assets, loading: loadingAssets } = useFirestoreCollection<Asset>('assets');
  const { data: orders, loading: loadingOrders } = useFirestoreCollection<WorkOrder>('orders', [orderBy('createdAt', 'desc')]);
  const { data: users, loading: loadingUsers } = useFirestoreCollection<any>('users');

  // Derived stats
  const stats = useMemo(() => {
    const activeAssets = assets.filter(a => a.status === 'ACTIVE').length;
    const pendingOrders = orders.filter(o => o.status === 'PENDIENTE' || o.status === 'EN_PROGRESO').length;
    const activeTechs = users.filter(u => u.role === 'TECHNICIAN' && u.status === 'ACTIVE').length;
    
    return {
      pendingWorkOrders: pendingOrders,
      registeredAssets: activeAssets,
      activeTechnicians: activeTechs,
      maintenanceScore: 100 // Logic can be refined
    };
  }, [assets, orders, users]);

  const archivedAssets = useMemo(() => assets.filter(a => a.status === 'ARCHIVED'), [assets]);
  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);

  const taskStats = useMemo(() => {
    let tComp = 0, tInc = 0, tNo = 0, tPen = 0, total = 0;
    orders.forEach(o => {
      o.tasks?.forEach(t => {
        total++;
        if (t.status === 'COMPLETADA') tComp++;
        else if (t.status === 'INCOMPLETA') tInc++;
        else if (t.status === 'NO_REALIZADA') tNo++;
        else tPen++;
      });
    });
    return { completadas: tComp, incompletas: tInc, noRealizadas: tNo, pendientes: tPen, total };
  }, [orders]);

  const costData = useMemo(() => {
    const costMap: Record<string, number> = {};
    orders.forEach(o => {
      if (o.cost) {
        costMap[o.assetName] = (costMap[o.assetName] || 0) + o.cost;
      }
    });
    return Object.entries(costMap)
      .map(([name, cost]) => ({ name, cost }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 8);
  }, [orders]);

  const interventionData = useMemo(() => {
    const timeMap: Record<string, number> = {};
    orders.forEach(o => {
      if (o.startTime && o.endTime) {
        const start = new Date(`1970-01-01T${o.startTime}:00`);
        const end = new Date(`1970-01-01T${o.endTime}:00`);
        const diffHrs = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
        timeMap[o.assetName] = (timeMap[o.assetName] || 0) + diffHrs;
      }
    });
    return Object.entries(timeMap)
      .map(([name, hours]) => ({ name, hours: parseFloat(hours.toFixed(1)) }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8);
  }, [orders]);

  const techPerformance = useMemo(() => {
    const techs = users.filter(u => u.role === 'TECHNICIAN');
    const techCounts: Record<string, { count: number; name: string; area: string }> = {};
    
    techs.forEach(t => {
      techCounts[t.id] = { count: 0, name: t.name || t.username, area: t.area || 'General' };
    });

    orders.forEach(order => {
      order.assignedTechnicians?.forEach(techId => {
        if (techCounts[techId]) {
          techCounts[techId].count++;
        }
      });
    });

    return Object.values(techCounts)
      .map(t => ({ name: t.name, total: t.count, area: t.area }))
      .sort((a, b) => b.total - a.total);
  }, [orders, users]);

  const totalCostValue = useMemo(() => orders.reduce((acc, curr) => acc + (curr.cost || 0), 0), [orders]);
  const totalCostFromChart = useMemo(() => costData.reduce((acc, curr) => acc + curr.cost, 0), [costData]);

  const downloadReport = async () => {
    if (!dashboardRef.current) return;
    
    const canvas = await html2canvas(dashboardRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#f8fafc'
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    // Header
    pdf.setFillColor(15, 23, 42); // slate-900
    pdf.rect(0, 0, pdfWidth, 40, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.text('CMMS - INFORME GENERAL DE GESTIÓN', 15, 25);
    pdf.setFontSize(10);
    pdf.text(`Fecha de generación: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 15, 32);
    
    // Content
    pdf.addImage(imgData, 'PNG', 0, 45, pdfWidth, pdfHeight);
    
    pdf.save(`informe_general_cmms_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const isLoading = loadingAssets || loadingOrders || loadingUsers;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-20">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Cargando datos del sistema...</p>
      </div>
    );
  }

  const statsCards = [
    { 
      label: 'Costo Total Manto', 
      value: `$${totalCostValue.toLocaleString()}`, 
      icon: DollarSign, 
      color: 'green',
      trend: `${orders.length} órdenes generadas`
    },
    { 
      label: 'Órdenes Pendientes', 
      value: stats.pendingWorkOrders, 
      icon: ClipboardCheck, 
      color: 'blue',
      trend: `${orders.length > 0 ? Math.round((stats.pendingWorkOrders / orders.length) * 100) : 0}% del total`
    },
    { 
      label: 'Técnicos Activos', 
      value: stats.activeTechnicians, 
      icon: Users, 
      color: 'slate',
      trend: 'Personal en turno'
    },
    { 
      label: 'Score de Mantenimiento', 
      value: `${stats.maintenanceScore}%`, 
      icon: TrendingUp, 
      color: 'green',
      trend: 'Eficiencia de cierre'
    },
  ];

  const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b', '#06b6d4'];

  return (
    <div className="space-y-8 pb-12" ref={dashboardRef}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard General</h1>
          <p className="text-slate-500 mt-1">Monitoreo en tiempo real del sistema de mantenimiento.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={downloadReport}
            className="px-6 py-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all font-bold text-xs uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-slate-900/10 active:scale-95"
          >
            <FileDown size={18} />
            <span>Descargar Informe PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={cn(
                "p-2.5 rounded-lg border transition-colors",
                card.color === 'blue' ? "bg-blue-50 text-blue-600 border-blue-100" :
                card.color === 'green' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                "bg-slate-50 text-slate-600 border-slate-200"
              )}>
                <card.icon size={20} />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{card.value}</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">{card.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Cost Analysis */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Costos por Equipo</h3>
              <p className="text-xs text-slate-500">Inversión total en mantenimiento (COP)</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costData} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} 
                  width={120}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Costo Total']}
                />
                <Bar dataKey="cost" radius={[0, 4, 4, 0]} barSize={20}>
                  {costData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                  <LabelList 
                    dataKey="cost" 
                    position="right" 
                    formatter={(v: any) => `$${v.toLocaleString()}`} 
                    style={{ fontSize: '9px', fontWeight: 'bold', fill: '#64748b' }} 
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution Pie Chart */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Activity size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Distribución de Inversión</h3>
              <p className="text-xs text-slate-500">Porcentaje del costo total por equipo</p>
            </div>
          </div>

          <div className="h-64 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={costData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="cost"
                >
                  {costData.map((_, index) => (
                    <Cell key={`cell-pie-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`$${value.toLocaleString()} (${totalCostFromChart > 0 ? ((value / totalCostFromChart) * 100).toFixed(1) : 0}%)`, 'Inversión']}
                  contentStyle={{ borderRadius: '12px', border: 'none' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-black text-slate-400 uppercase">Total COP</span>
              <span className="text-sm font-bold text-slate-900">${totalCostFromChart.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Intervention Time Analysis */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Timer size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Tiempos de Intervención</h3>
              <p className="text-xs text-slate-500">Horas totales invertidas en labor por equipo</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={interventionData} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} 
                  width={120}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${value} hrs`, 'Tiempo Total']}
                />
                <Bar dataKey="hours" radius={[0, 4, 4, 0]} barSize={20}>
                  {interventionData.map((_, index) => (
                    <Cell key={`cell-time-${index}`} fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]} />
                  ))}
                  <LabelList 
                    dataKey="hours" 
                    position="right" 
                    formatter={(v: any) => `${v}h`} 
                    style={{ fontSize: '9px', fontWeight: 'bold', fill: '#64748b' }} 
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Technician Performance */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Users size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Intervenciones por Técnico</h3>
                <p className="text-xs text-slate-500">Cantidad total de órdenes asignadas por personal</p>
              </div>
            </div>
          </div>

          {techPerformance.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                <Users size={24} className="text-slate-300" />
              </div>
              <p className="text-xs text-slate-500 font-medium italic">No hay datos de asignación disponibles</p>
            </div>
          ) : (
            <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2 max-h-[350px]">
              {techPerformance.map((tech, idx) => (
                <div key={tech.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{tech.name}</p>
                        <p className="text-[10px] text-blue-600 font-black uppercase tracking-tighter">{tech.area}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-slate-900">{tech.total}</span>
                      <span className="text-[9px] text-slate-400 font-bold block uppercase">Asignaciones</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (tech.total / (techPerformance[0]?.total || 1)) * 100)}%` }}
                      className="h-full bg-blue-600 rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Task Performance Statistics */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <TrendingUp size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Rendimiento de Tareas</h3>
            <p className="text-xs text-slate-500">Distribución de resultados de mantenimiento preventivo</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'Completadas', val: taskStats.completadas, color: 'bg-emerald-500', icon: ClipboardCheck, bg: 'bg-emerald-50' },
            { label: 'Incompletas', val: taskStats.incompletas, color: 'bg-amber-500', icon: AlertTriangle, bg: 'bg-amber-50' },
            { label: 'No Realizadas', val: taskStats.noRealizadas, color: 'bg-rose-500', icon: X, bg: 'bg-rose-50' },
            { label: 'Pendientes', val: taskStats.pendientes, color: 'bg-slate-400', icon: Clock, bg: 'bg-slate-50' }
          ].map((item) => (
            <div key={item.label} className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", item.bg)}>
                    <item.icon size={16} className={cn(item.color.replace('bg-', 'text-'))} />
                  </div>
                  <span className="text-xs font-bold text-slate-600">{item.label}</span>
                </div>
                <span className="text-lg font-black text-slate-900">
                  {taskStats.total > 0 ? Math.round((item.val / taskStats.total) * 100) : 0}%
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${taskStats.total > 0 ? (item.val / taskStats.total) * 100 : 0}%` }}
                  className={cn("h-full rounded-full transition-all duration-1000", item.color)}
                />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.val} ACTIVIDADES</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <h2 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Órdenes de Trabajo Recientes</h2>
        </div>
        
        {recentOrders.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
              <FileSearch size={32} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">No hay órdenes de trabajo pendientes</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold tracking-widest border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">OT</th>
                  <th className="px-6 py-4">Equipo</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Prioridad</th>
                  <th className="px-6 py-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-900 font-bold font-mono text-xs">#{order.orderNumber}</td>
                    <td className="px-6 py-4 text-slate-600 text-xs font-bold">{order.assetName}</td>
                    <td className="px-6 py-4 text-slate-500 text-xs">{order.date}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter",
                        order.priority === 'ALTA' ? "bg-rose-50 text-rose-600 border border-rose-100" :
                        order.priority === 'MEDIA' ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-blue-50 text-blue-600 border border-blue-100"
                      )}>
                        {order.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter",
                        order.status === 'COMPLETADA' ? "bg-emerald-100 text-emerald-700" : "bg-blue-50 text-blue-600"
                      )}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {archivedAssets.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-950 rounded-3xl p-8 shadow-xl shadow-slate-950/20 text-white overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 -rotate-12 translate-x-8 -translate-y-4">
            <Archive size={160} />
          </div>
          
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex items-start gap-4">
              <div className="p-4 bg-white/10 rounded-2xl">
                <Archive size={28} className="text-rose-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Archivo de Activos</h3>
                <p className="text-slate-400 text-sm mt-1 max-w-md">
                  Hay <span className="text-white font-bold">{archivedAssets.length} equipos</span> inactivos. 
                  Consulte historiales históricos para trazabilidad.
                </p>
              </div>
            </div>

            <button className="px-8 py-4 bg-white text-slate-950 font-bold rounded-2xl text-sm flex items-center gap-2 hover:bg-slate-100 transition-all shrink-0 uppercase tracking-widest">
              Consultar Archivo
              <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      )}

      {/* Floating Smart Assistant */}
      <SmartAssistant assets={assets} orders={orders} />
    </div>
  );
}
