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
  MapPin,
  Layers,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Key,
  Camera,
  Image as ImageIcon,
  Check,
  Upload,
  Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ViewType } from '../../types';
import { Logo } from '../Logo';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const PRESET_AVATARS = [
  { name: 'Mujer Elegante', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop' },
  { name: 'Hombre Inteligente', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop' },
  { name: 'Mujer Feliz', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop' },
  { name: 'Hombre Tecnológico', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop' },
  { name: 'Mujer Amistosa', url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop' },
  { name: 'Hombre Profesional', url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop' },
];

export default function AdminLayout({ children, currentView, onViewChange }: AdminLayoutProps) {
  const { user, logout, darkMode, setDarkMode, updateUser } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Collapse sidebar state (persisted in localStorage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  // Profile overlay / modals states
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  // Forms states and loader states
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [credentialsForm, setCredentialsForm] = useState({
    name: user?.name || `${user?.firstName || ''} ${user?.lastName || ''}` || '',
    username: user?.username || '',
    email: user?.email || '',
    password: '',
  });

  const [customPhotoUrl, setCustomPhotoUrl] = useState(user?.photoUrl || '');
  const [notification, setNotification] = useState<string | null>(null);

  const openCredentialsModal = () => {
    setCredentialsForm({
      name: user?.name || `${user?.firstName || ''} ${user?.lastName || ''}` || '',
      username: user?.username || '',
      email: user?.email || '',
      password: '',
    });
    setIsCredentialsModalOpen(true);
    setIsProfileMenuOpen(false);
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSavingCredentials(true);
    
    const updatedFields = {
      name: credentialsForm.name,
      username: credentialsForm.username,
      email: credentialsForm.email,
      ...(credentialsForm.password ? { password: credentialsForm.password } : {})
    };

    try {
      // 1. Update local Zustand state
      updateUser(updatedFields);

      // 2. Persist to Firestore
      await setDoc(doc(db, 'users', user.id), {
        ...user,
        ...updatedFields,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setNotification('Credenciales actualizadas exitosamente');
      setIsCredentialsModalOpen(false);
    } catch (err) {
      console.error(err);
      setNotification('Error al guardar credenciales');
    } finally {
      setIsSavingCredentials(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const openPhotoModal = () => {
    setCustomPhotoUrl(user?.photoUrl || '');
    setIsPhotoModalOpen(true);
    setIsProfileMenuOpen(false);
  };

  const handleSavePhoto = async (url: string) => {
    if (!user) return;
    try {
      // 1. Update local Zustand state
      updateUser({ photoUrl: url });

      // 2. Persist to Firestore
      await setDoc(doc(db, 'users', user.id), {
        ...user,
        photoUrl: url,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setNotification('Foto de perfil actualizada exitosamente');
    } catch (err) {
      console.error(err);
      setNotification('Error al guardar la foto');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, seleccione un archivo de imagen válido (PNG, JPG, JPEG).');
      return;
    }
    
    // Limits size to 1.5MB to stay fully reliable and light in Firestore fields
    if (file.size > 1.5 * 1024 * 1024) {
      alert('La imagen es demasiado grande. Por favor, suba una imagen de menos de 1.5MB.');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setCustomPhotoUrl(base64);
      handleSavePhoto(base64);
      setIsUploading(false);
      setIsPhotoModalOpen(false);
    };
    reader.onerror = () => {
      setIsUploading(false);
      alert('Error al leer el archivo de imagen.');
    };
    reader.readAsDataURL(file);
  };

  const toggleSidebar = () => {
    const nextVal = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextVal);
    localStorage.setItem('sidebar-collapsed', String(nextVal));
  };

  const menuItems = ([
    { icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard' },
    { icon: MapPin, label: 'Sedes / Ubicaciones', view: 'locations' },
    { icon: Users, label: 'Técnicos', view: 'technicians' },
    { icon: Package, label: 'Activos', view: 'assets' },
    { icon: Layers, label: 'Stock de Repuestos', view: 'spare-parts' },
    { icon: Calendar, label: 'Cronograma', view: 'schedule' },
    { icon: ClipboardList, label: 'Órdenes de Trabajo', view: 'orders' },
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
    orders: 'Órdenes de Trabajo',
    technicians: 'Panel de Técnicos',
    archive: 'Archivo de Equipos',
    schedule: 'Cronograma de Mantenimiento',
    settings: 'Configuración del Sistema',
    locations: 'Gestión de Sedes y Ubicaciones',
    'spare-parts': 'Stock de Repuestos'
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden relative transition-colors duration-300">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-all duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 bg-slate-950 flex flex-col border-r border-slate-800 transition-all duration-300 ease-in-out lg:translate-x-0 lg:static shrink-0",
        isSidebarCollapsed ? "lg:w-20" : "lg:w-64",
        isMobileMenuOpen ? "translate-x-0 w-72 shadow-2xl shadow-blue-500/10" : "-translate-x-full w-72"
      )}>
        <div className={cn(
          "p-6 border-b border-slate-800 flex items-center justify-between",
          isSidebarCollapsed ? "lg:p-4 lg:justify-center" : ""
        )}>
          {isSidebarCollapsed ? (
            <Logo variant="icon" size={32} />
          ) : (
            <Logo variant="full" size={32} />
          )}
          
          <div className="flex items-center gap-1">
            {/* Desktop Collapse/Expand button */}
            <button 
              onClick={toggleSidebar}
              className="hidden lg:flex p-1.5 text-slate-500 hover:text-white hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
              title={isSidebarCollapsed ? "Expandir menú" : "Contraer menú"}
            >
              {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            
            {/* Mobile close button */}
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-slate-500 hover:text-white lg:hidden"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          <div className={cn(
            "text-xs font-bold text-slate-500 uppercase tracking-widest px-3 mb-4",
            isSidebarCollapsed ? "lg:hidden" : ""
          )}>
            {user?.role === 'ADMIN' ? 'Admin' : 'Técnico'} Panel
          </div>
          {menuItems.map((item) => {
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => {
                  onViewChange(item.view);
                  setIsMobileMenuOpen(false);
                }}
                title={isSidebarCollapsed ? item.label : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-bold cursor-pointer",
                  isActive 
                    ? "bg-blue-600 text-white shadow-xl shadow-blue-600/30" 
                    : "text-slate-400 hover:text-white hover:bg-slate-900",
                  isSidebarCollapsed ? "lg:justify-center lg:px-0 lg:h-12 lg:w-12 lg:mx-auto" : ""
                )}
              >
                <item.icon size={18} className={cn(isActive ? "opacity-100" : "opacity-60 group-hover:opacity-100")} />
                <span className={cn(isSidebarCollapsed ? "lg:hidden" : "")}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User profile section at bottom of sidebar */}
        <div className="p-4 border-t border-slate-800 relative">
          <AnimatePresence>
            {isProfileMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsProfileMenuOpen(false)}
                />
                
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className={cn(
                    "absolute bottom-full mb-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl z-20 w-64",
                    isSidebarCollapsed ? "left-4" : "left-4 right-4"
                  )}
                >
                  <div className="border-b border-slate-800 pb-2 mb-2 text-left">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Ajustes de Perfil</p>
                    <p className="text-xs font-bold text-slate-300 truncate mt-0.5">{user?.email}</p>
                  </div>
                  
                  <div className="space-y-1">
                    {/* Dark mode option */}
                    <button
                      onClick={() => {
                        setDarkMode(!darkMode);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {darkMode ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-blue-400" />}
                        <span>{darkMode ? "Modo Claro" : "Modo Oscuro"}</span>
                      </div>
                      <div className={cn(
                        "w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 shrink-0",
                        darkMode ? "bg-blue-600" : "bg-slate-700"
                      )}>
                        <div className={cn(
                          "w-3 h-3 rounded-full bg-white transition-all duration-200",
                          darkMode ? "translate-x-4" : "translate-x-0"
                        )} />
                      </div>
                    </button>

                    {/* Change credentials option */}
                    <button
                      onClick={openCredentialsModal}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                    >
                      <Key size={14} className="text-blue-400" />
                      <span>Credenciales de Acceso</span>
                    </button>

                    {/* Change photo option */}
                    <button
                      onClick={openPhotoModal}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                    >
                      <Camera size={14} className="text-emerald-400" />
                      <span>Cambiar Foto</span>
                    </button>

                    {/* Logout option */}
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-xl transition-all cursor-pointer"
                    >
                      <LogOut size={14} />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <div 
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className={cn(
              "flex items-center gap-3 rounded-xl p-2 hover:bg-slate-900 transition-colors cursor-pointer select-none",
              isSidebarCollapsed ? "justify-center px-0" : ""
            )}
            title={isSidebarCollapsed ? "Opciones de administrador" : undefined}
          >
            {user?.photoUrl ? (
              <img 
                src={user.photoUrl} 
                alt="Avatar" 
                className="w-10 h-10 rounded-full object-cover border border-slate-700"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center border shrink-0",
                user?.role === 'ADMIN' ? "bg-slate-800 border-slate-700" : "bg-blue-900/50 border-blue-500/30"
              )}>
                <span className="text-blue-400 font-bold text-sm">
                  {(user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`)?.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </span>
              </div>
            )}

            {!isSidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-white truncate">{user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.role === 'ADMIN' ? 'Administrador' : 'Técnico Especialista'}</p>
                </div>
                <div className="text-slate-500 hover:text-white transition-colors">
                  <Settings size={16} />
                </div>
              </>
            )}
          </div>

          {!isSidebarCollapsed && (
            <div className="mt-4 px-2 text-left">
              <p className="text-[9px] font-medium text-slate-600 leading-relaxed uppercase tracking-[0.1em]">
                Este software es desarrollado bajo la empresa <span className="text-blue-500/80 font-bold">SC Pro</span>
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        {/* Navbar */}
        <header className="h-16 md:h-20 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 relative z-10 shadow-sm transition-colors duration-300">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white lg:hidden bg-slate-50 dark:bg-slate-900 rounded-lg cursor-pointer"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-base md:text-xl font-bold text-slate-950 dark:text-white tracking-tight truncate">
              {viewTitles[currentView]}
            </h1>
            <span className="hidden sm:flex px-3 py-1 rounded-full text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 items-center gap-2 ring-1 ring-emerald-500/20 dark:ring-emerald-500/10 uppercase tracking-tighter">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> 
              Online 
            </span>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <button className="p-2 text-slate-400 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-900 rounded-xl transition-all relative group cursor-pointer">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-950" />
            </button>
            <div className="h-8 w-px bg-slate-100 dark:bg-slate-800 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Sesión de</p>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{(user?.name || user?.firstName || '')?.split(' ')[0]}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Notification Toast */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-20 right-8 bg-blue-600 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-lg z-50 uppercase tracking-wider"
            >
              {notification}
            </motion.div>
          )}
        </AnimatePresence>

        {/* View Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50 dark:bg-slate-900/40 transition-colors duration-300">
          <div className="max-w-7xl mx-auto min-h-full">
            {children}
          </div>
        </main>
      </div>

      {/* MODAL: CAMBIAR CREDENCIALES DE ACCESO */}
      <AnimatePresence>
        {isCredentialsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCredentialsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl shadow-2xl overflow-hidden p-8 text-left z-10 border border-slate-100 dark:border-slate-800"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <Key size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Credenciales de Acceso</h3>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
                    Actualice su nombre, correo o contraseña de inicio de sesión.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveCredentials} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={credentialsForm.name}
                    onChange={(e) => setCredentialsForm({ ...credentialsForm, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Nombre de Usuario
                  </label>
                  <input
                    type="text"
                    required
                    value={credentialsForm.username}
                    onChange={(e) => setCredentialsForm({ ...credentialsForm, username: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    required
                    value={credentialsForm.email}
                    onChange={(e) => setCredentialsForm({ ...credentialsForm, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Nueva Contraseña (Opcional)
                  </label>
                  <input
                    type="password"
                    placeholder="Dejar en blanco para no cambiar"
                    value={credentialsForm.password}
                    onChange={(e) => setCredentialsForm({ ...credentialsForm, password: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="flex gap-3 justify-end mt-8">
                  <button
                    type="button"
                    disabled={isSavingCredentials}
                    onClick={() => setIsCredentialsModalOpen(false)}
                    className="px-6 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors uppercase text-[11px] tracking-widest cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingCredentials}
                    className="px-6 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all uppercase text-[11px] tracking-widest cursor-pointer flex items-center gap-2 disabled:opacity-75"
                  >
                    {isSavingCredentials && <Loader2 size={14} className="animate-spin" />}
                    <span>{isSavingCredentials ? 'Guardando...' : 'Guardar Cambios'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CAMBIAR FOTO DE PERFIL */}
      <AnimatePresence>
        {isPhotoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPhotoModalOpen(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl shadow-2xl overflow-hidden p-8 text-left z-10 border border-slate-100 dark:border-slate-800"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Camera size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Foto de Perfil</h3>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
                    Suba una foto desde su dispositivo o seleccione un avatar preestablecido.
                  </p>
                </div>
              </div>

              {/* Drag and Drop Upload Zone */}
              <div className="mb-6">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Subir Foto desde su Equipo
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('profile-file-input')?.click()}
                  className={cn(
                    "relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer",
                    dragActive 
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/10 scale-[0.99]" 
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/30"
                  )}
                >
                  <input
                    id="profile-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={32} className="text-blue-500 animate-spin" />
                      <p className="text-xs font-bold text-slate-500">Procesando imagen...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="p-3 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                        <Upload size={20} />
                      </div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Arrastre una imagen aquí o <span className="text-blue-600 dark:text-blue-400 hover:underline">búsquela en su equipo</span>
                      </p>
                      <p className="text-[10px] font-medium text-slate-400">
                        PNG, JPG o JPEG de hasta 1.5MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Grid of preset avatars */}
              <div className="mb-6">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  O Seleccione un Avatar Preestablecido
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {PRESET_AVATARS.map((avatar) => {
                    const isSelected = user?.photoUrl === avatar.url || customPhotoUrl === avatar.url;
                    return (
                      <button
                        key={avatar.name}
                        type="button"
                        onClick={() => {
                          setCustomPhotoUrl(avatar.url);
                          handleSavePhoto(avatar.url);
                        }}
                        className={cn(
                          "relative rounded-2xl overflow-hidden aspect-square border-2 transition-all p-0.5 cursor-pointer bg-slate-50 dark:bg-slate-950",
                          isSelected ? "border-blue-500 ring-2 ring-blue-500/20 scale-95" : "border-transparent hover:scale-105"
                        )}
                        title={avatar.name}
                      >
                        <img 
                          src={avatar.url} 
                          alt={avatar.name} 
                          className="w-full h-full object-cover rounded-xl"
                          referrerPolicy="no-referrer"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center rounded-xl">
                            <div className="bg-blue-600 text-white rounded-full p-1 shadow-md">
                              <Check size={12} strokeWidth={4} />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom URL input */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    URL de Foto Personalizada
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://ejemplo.com/foto.jpg"
                      value={customPhotoUrl}
                      onChange={(e) => setCustomPhotoUrl(e.target.value)}
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => handleSavePhoto(customPhotoUrl)}
                      className="px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Check size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex justify-end mt-8">
                  <button
                    type="button"
                    onClick={() => setIsPhotoModalOpen(false)}
                    className="px-6 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors uppercase text-[11px] tracking-widest cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
