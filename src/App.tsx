import { useState } from 'react';
import { useAuthStore } from './store/useAuthStore';
import LoginPage from './features/auth/LoginPage';
import AdminLayout from './components/layout/AdminLayout';
import Dashboard from './features/admin/Dashboard';
import AssetsPage from './features/assets/AssetsPage';
import ArchivePage from './features/assets/ArchivePage';
import TechniciansPage from './features/admin/TechniciansPage';
import WorkOrdersPage from './features/orders/WorkOrdersPage';
import MaintenanceSchedule from './features/assets/MaintenanceSchedule';
import { ViewType } from './types';
import { useEffect } from 'react';

export default function App() {
  const { user, isAuthenticated } = useAuthStore();
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  useEffect(() => {
    if (isAuthenticated && user?.role === 'TECHNICIAN' && currentView === 'dashboard') {
      setCurrentView('assets');
    }
  }, [isAuthenticated, user, currentView]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'assets':
        return <AssetsPage />;
      case 'orders':
        return <WorkOrdersPage />;
      case 'archive':
        return <ArchivePage />;
      case 'schedule':
        return <MaintenanceSchedule />;
      case 'technicians':
        return <TechniciansPage />;
      default:
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <h2 className="text-2xl font-bold text-slate-800">Módulo en Desarrollo</h2>
            <p className="text-slate-500 mt-2">Esta sección estará disponible próximamente.</p>
          </div>
        );
    }
  };

  return (
    <AdminLayout currentView={currentView} onViewChange={setCurrentView}>
      {renderView()}
    </AdminLayout>
  );
}
