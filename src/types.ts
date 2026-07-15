export interface User {
  id: string;
  username: string;
  password?: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role: 'ADMIN' | 'TECHNICIAN';
  area?: string;
  status: 'ACTIVE' | 'INACTIVE';
  locationId?: string;
  photoUrl?: string;
}

export interface Location {
  id: string;
  department: string;
  city: string;
  place: string;
  name: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updatedFields: Partial<User>) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
}

export interface MaintenanceStats {
  pendingWorkOrders: number;
  registeredAssets: number;
  activeTechnicians: number;
  maintenanceScore: number;
}

export interface WorkOrder {
  id: string;
  orderNumber: string; // Sequential 00001
  assetId: string;
  assetName: string;
  locationId?: string;
  priority: 'ALTA' | 'MEDIA' | 'BAJA';
  status: 'PENDIENTE' | 'EN_PROGRESO' | 'COMPLETADA';
  type: 'MAINTENANCE' | 'CALIBRATION';
  tasks: {
    description: string;
    status: 'COMPLETADA' | 'INCOMPLETA' | 'NO_REALIZADA' | 'PENDIENTE';
    note?: string;
  }[];
  pendingTasks?: string;
  maintenanceCost?: number;
  assignedTechnicians: string[]; // IDs
  date: string;
  startTime: string;
  endTime: string;
  cost?: number;
  weekNumber: number;
  year: number;
  validated?: boolean;
  usedParts?: {
    partId: string;
    partName: string;
    quantity: number;
    fullyUsed: boolean;
  }[];
  createdAt: string;
}

export type ViewType = 'dashboard' | 'assets' | 'orders' | 'technicians' | 'archive' | 'schedule' | 'settings' | 'locations' | 'spare-parts';

export interface SparePart {
  id: string;
  name: string;
  supplier: string;
  unitCost: number;
  stock: number;
  minStock: number;
  createdAt: string;
  updatedAt?: string;
}

export interface MaintenanceActivity {
  id: string;
  description: string;
  frequencyWeeks: number;
  priority?: 'ALTA' | 'MEDIA' | 'BAJA';
  type: 'MAINTENANCE' | 'CALIBRATION';
  requiredPartId?: string;
}

export interface Asset {
  id: string;
  name: string;
  description?: string;
  serialNumber: string; // Made required for consistency in logic
  year?: number;
  type?: 'INTERNO' | 'EXTERNO';
  activities: MaintenanceActivity[];
  imageUrl?: string;
  manualUrl?: string;
  locationId?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  brand?: string;
  model?: string;
  invimaRegistration?: string;
  commercializationPermit?: string;
  manufacturerInfo?: string;
  supplierInfo?: string;
  institutionalInventoryNumber?: string;
  updatedAt?: string;
  createdAt?: string;
}

export type TechnicianArea = 'Mecánico' | 'Eléctrico' | 'Electrónico' | 'Biomédico' | 'Procesos';

export interface Technician extends User {
  firstName: string;
  lastName: string;
  phone: string;
  area: TechnicianArea;
  role: 'TECHNICIAN';
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt?: string;
}
