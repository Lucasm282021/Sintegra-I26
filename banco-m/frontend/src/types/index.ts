export interface Account {
  id: string;
  type: string;
  currency: 'ARS' | 'USD';
  balance: number;
  accountNumber: string;
  cbu: string;
  cbuFormatted: string;
  alias: string;
  cuit?: string;
  isPrimary?: boolean;
  status: 'Activa' | 'Activa (Modo Prueba)' | 'Simulada' | 'Inactiva';
  dailyLimit?: number;
  iconName: string;
}

export type TransactionCategory = 'ingresos' | 'egresos' | 'transferencias' | 'servicios';

export interface Transaction {
  id: string;
  concept: string;
  description: string;
  amount: number; // positive for income, negative for expense
  currency: 'ARS' | 'USD';
  date: string; // e.g. "15/10/2024"
  time: string; // e.g. "16:42 hs"
  group: 'hoy' | 'ayer' | '05oct' | 'anteriores';
  groupLabel: string;
  status: 'Completado' | 'Acreditado' | 'Transferido' | 'Pagado' | 'Pendiente de liquidación' | 'Realizado';
  category: TransactionCategory;
  tags: string;
  icon: string;
  counterpart?: string;
  counterpartDetail?: string; // e.g. "Alias: facu.diaz.sim" or "CBU: •••• 4120"
  referenceId: string;
  channel: string;
}

export interface UserProfile {
  name: string;
  email: string;
  cuil: string;
  verified: boolean;
  tier: string;
  avatarUrl: string;
  notificationsCount: number;
}
