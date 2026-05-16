import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  LayoutDashboard, 
  Settings, 
  Users, 
  ClipboardList, 
  Package, 
  LogOut, 
  Bell, 
  Archive,
  Calendar,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ViewType } from '../../types';
import { Logo } from '../Logo';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export default function AdminLayout({ children, currentView, onViewChange }: AdminLayoutProps) {
  const { user, logout } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = ([
    { icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard' },
    { icon: Package, label: 'Activos', view: 'assets' },
    { icon: ClipboardList, label: 'Ordenes de Trabajo', view: 'orders' },
    { icon: Calendar, label: 'Cronograma', view: 'schedule' },
    { icon: Users, label: 'Tecnicos', view: 'technicians' },
    { icon: Archive, label: 'Archivo', view: 'archive' },
    { icon: Settings, label: 'Configuración', view: 'settings' },
  ] as { icon: any; label: string; view: ViewType }[]).filter(item => {
    if (user?.role === 'TECHNICIAN') {
      // Technicians only see Assets, Work Orders and Schedule
      return ['assets', 'orders', 'schedule'].includes(item.view);
    }
    return true;
  });

  const viewTitles: Record<ViewType, string> = {
    dashboard: 'Dashboard General',
    assets: 'Gestión de Activos',
    orders: 'Ordenes de Trabajo',
    technicians: 'Panel de Tecnicos',
    archive: 'Archivo de Equipos',
    schedule: 'Cronograma de Mantenimiento',
    settings: 'Configuración del Sistema'
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-all duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 flex flex-col border-r border-slate-800 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:w-64 shrink-0",
        isMobileMenuOpen ? "translate-x-0 shadow-2xl shadow-blue-500/10" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <Logo variant="full" size={32} />
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 text-slate-500 hover:text-white lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest px-3 mb-4">{user?.role === 'ADMIN' ? 'Admin' : 'Técnico'} Panel</div>
          {menuItems.map((item) => {
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => {
                  onViewChange(item.view);
                  setIsMobileMenuOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-bold",
                  isActive 
                    ? "bg-blue-600 text-white shadow-xl shadow-blue-600/30" 
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                )}
              >
                <item.icon size={18} className={cn(isActive ? "opacity-100" : "opacity-60 group-hover:opacity-100")} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-900 transition-colors cursor-default">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center border",
              user?.role === 'ADMIN' ? "bg-slate-800 border-slate-700" : "bg-blue-900/50 border-blue-500/30"
            )}>
              <span className="text-blue-400 font-bold text-sm">
                {user?.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.role === 'ADMIN' ? 'Administrador' : 'Técnico Especialista'}</p>
            </div>
            <button 
              onClick={() => logout()}
              className="text-slate-500 hover:text-red-400 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
          <div className="mt-4 px-2">
            <p className="text-[9px] font-medium text-slate-600 leading-relaxed uppercase tracking-[0.1em]">
              Este software es desarrollado bajo la empresa <span className="text-blue-500/80 font-bold">SC Pro</span>
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Navbar */}
        <header className="h-16 md:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 relative z-10 shadow-sm">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-500 hover:text-slate-900 lg:hidden bg-slate-50 rounded-lg"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-base md:text-xl font-bold text-slate-950 tracking-tight truncate">
              {viewTitles[currentView]}
            </h1>
            <span className="hidden sm:flex px-3 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-600 items-center gap-2 ring-1 ring-emerald-500/20 uppercase tracking-tighter">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> 
              Online 
            </span>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all relative group">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
            </button>
            <div className="h-8 w-px bg-slate-100 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Sesión de</p>
                <p className="text-xs font-bold text-slate-700">{user?.name.split(' ')[0]}</p>
              </div>
            </div>
          </div>
        </header>

        {/* View Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
          <div className="max-w-7xl mx-auto min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
