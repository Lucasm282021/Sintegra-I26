import React, { createContext, useContext, useEffect, useState } from 'react';
import { Account, Transaction, UserProfile } from '../types';
import { INITIAL_USER } from '../data/mockData';
import { bankApi, BankAccount, BankMovement, BankQrPayment, BankQrStatus } from '../api/bankApi';

export type NavTab = 'inicio' | 'cuentas' | 'transferir' | 'movimientos' | 'perfil';

interface ToastState {
  visible: boolean;
  message: string;
  icon: string;
}

interface BankingContextType {
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (cuit: string) => Promise<boolean>;
  registerAccount: (cuit: string, titularNombre: string) => Promise<boolean>;
  logout: () => void;
  user: UserProfile;
  cuit: string;
  accounts: Account[];
  transactions: Transaction[];
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isBalanceHidden: boolean;
  toggleBalanceVisibility: () => void;
  toast: ToastState;
  showToast: (message: string, icon?: string) => void;
  copyToClipboard: (text: string, label?: string) => void;
  selectedTransaction: Transaction | null;
  setSelectedTransaction: (tx: Transaction | null) => void;
  isTransferModalOpen: boolean;
  setIsTransferModalOpen: (open: boolean) => void;
  isPayServiceModalOpen: boolean;
  setIsPayServiceModalOpen: (open: boolean) => void;
  isDepositModalOpen: boolean;
  setIsDepositModalOpen: (open: boolean) => void;
  isQrModalOpen: boolean;
  setIsQrModalOpen: (open: boolean) => void;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
  isCbuSheetOpen: boolean;
  setIsCbuSheetOpen: (open: boolean) => void;
  downloadCbuPdf: (account?: Account) => void;
  shareWhatsApp: (account?: Account) => void;
  sendTransfer: (originAccountId: string, recipient: string, amount: number, concept: string) => Promise<boolean>;
  payService: (originAccountId: string, serviceName: string, amount: number, identifier: string) => Promise<boolean>;
  depositFunds: (accountId: string, amount: number) => Promise<boolean>;
  createQr: (destination: string, destinationType: 'CUIT' | 'CBU', type: 'COMERCIO' | 'ARCA' | 'ARBA' | 'MUNICIPALIDAD', amount: number, description: string, reference: string) => Promise<BankQrPayment | null>;
  registerCommerce: () => Promise<boolean>;
  payQr: (pagoId: string) => Promise<boolean>;
  getQrStatus: (pagoId: string) => Promise<BankQrStatus | null>;
  refreshBankData: () => Promise<void>;
  resetSandboxData: () => void;
  formatCurrency: (amount: number, currency?: 'ARS' | 'USD') => string;
}

const BankingContext = createContext<BankingContextType | undefined>(undefined);
const CUIT_STORAGE_KEY = 'boreal.bank.cuit';

function normalizeCuit(value: string) {
  return value.replace(/\D/g, '');
}

function formatCbu(cbu: string) {
  return cbu.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function toAccount(account: BankAccount): Account {
  return {
    id: account.id,
    type: 'Cuenta bancaria en pesos',
    currency: 'ARS',
    balance: Number(account.saldo),
    accountNumber: `CBU ${account.cbu.slice(-8)}`,
    cbu: account.cbu,
    cbuFormatted: formatCbu(account.cbu),
    alias: account.alias,
    cuit: account.cuit,
    isPrimary: true,
    status: account.activa ? 'Activa' : 'Inactiva',
    iconName: 'savings',
  };
}

function toTransaction(movement: BankMovement): Transaction {
  const date = new Date(movement.creadoEn);
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const isDebit = movement.tipo === 'DEBITO';
  const isTransfer = movement.origen === 'TRANSFERENCIA';
  const description = movement.descripcion || (isDebit ? 'Débito bancario' : 'Acreditación bancaria');
  const amount = Number(movement.monto);
  const today = new Date();
  const isToday = validDate.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday = validDate.toDateString() === yesterday.toDateString();

  return {
    id: movement.id,
    concept: description,
    description,
    amount: isDebit ? -amount : amount,
    currency: 'ARS',
    date: validDate.toLocaleDateString('es-AR'),
    time: `${validDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs`,
    group: isToday ? 'hoy' : isYesterday ? 'ayer' : 'anteriores',
    groupLabel: validDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }),
    status: isDebit ? 'Completado' : 'Acreditado',
    category: isTransfer ? 'transferencias' : movement.origen === 'OTRO' ? 'servicios' : isDebit ? 'egresos' : 'ingresos',
    tags: `${movement.tipo.toLowerCase()} ${(movement.origen || '').toLowerCase()} ${description.toLowerCase()}`,
    icon: isTransfer ? 'swap_horiz' : isDebit ? 'north_east' : 'south_west',
    counterpart: movement.origen || 'Banco',
    counterpartDetail: movement.referencia ? `Referencia: ${movement.referencia}` : description,
    referenceId: movement.referencia || movement.id,
    channel: `banco-m · ${movement.origen || 'MOVIMIENTO'}`,
  };
}

function profileFromAccount(account: BankAccount, current: UserProfile): UserProfile {
  return {
    ...current,
    name: account.titularNombre,
    cuil: account.cuit,
    email: `${account.cuit}@boreal.local`,
    verified: account.activa,
    tier: account.activa ? 'Titular banco-m' : 'Cuenta inactiva',
    notificationsCount: 0,
  };
}

export const BankingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [cuit, setCuit] = useState('');
  const [user, setUser] = useState<UserProfile>(INITIAL_USER);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<NavTab>('inicio');
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isPayServiceModalOpen, setIsPayServiceModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCbuSheetOpen, setIsCbuSheetOpen] = useState(false);

  const [toast, setToast] = useState<ToastState>({ visible: false, message: '', icon: 'check_circle' });

  const showToast = (message: string, icon = 'check_circle') => {
    setToast({ visible: true, message, icon });
    setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 3200);
  };

  const applyBankData = (account: BankAccount, movements: BankMovement[]) => {
    setCuit(account.cuit);
    setAccounts([toAccount(account)]);
    setTransactions(movements.map(toTransaction));
    setUser((current) => profileFromAccount(account, current));
    setIsAuthenticated(true);
  };

  const refreshBankData = async () => {
    if (!cuit) throw new Error('No hay un CUIT asociado a la sesión');
    const account = await bankApi.getAccount(cuit);
    const movements = await bankApi.getMovements(account.id);
    applyBankData(account, movements.items);
  };

  useEffect(() => {
    const savedCuit = localStorage.getItem(CUIT_STORAGE_KEY);
    if (!savedCuit) {
      setIsInitializing(false);
      return;
    }

    const normalized = normalizeCuit(savedCuit);
    Promise.all([bankApi.getAccount(normalized)]).then(async ([account]) => {
      const movements = await bankApi.getMovements(account.id);
      applyBankData(account, movements.items);
    }).catch((error: unknown) => {
      localStorage.removeItem(CUIT_STORAGE_KEY);
      setCuit('');
      setAccounts([]);
      setTransactions([]);
      setIsAuthenticated(false);
      showToast(error instanceof Error ? error.message : 'No se pudo recuperar la cuenta del banco', 'cloud_off');
    }).finally(() => setIsInitializing(false));
  }, []);

  const login = async (cuitInput: string) => {
    const normalized = normalizeCuit(cuitInput);
    if (normalized.length !== 11) {
      showToast('Ingresá un CUIT de 11 dígitos', 'warning');
      return false;
    }
    try {
      const account = await bankApi.getAccount(normalized);
      const movements = await bankApi.getMovements(account.id);
      localStorage.setItem(CUIT_STORAGE_KEY, normalized);
      applyBankData(account, movements.items);
      showToast(`Cuenta de ${account.titularNombre} conectada a banco-m`, 'verified');
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo conectar la cuenta', 'error');
      return false;
    }
  };

  const registerAccount = async (cuitInput: string, titularNombre: string) => {
    const normalized = normalizeCuit(cuitInput);
    if (normalized.length !== 11) {
      showToast('Ingresá un CUIT de 11 dígitos', 'warning');
      return false;
    }
    if (titularNombre.trim().length < 2) {
      showToast('Ingresá el nombre del titular', 'warning');
      return false;
    }
    try {
      const account = await bankApi.createAccount(normalized, titularNombre.trim());
      localStorage.setItem(CUIT_STORAGE_KEY, normalized);
      applyBankData(account, []);
      showToast('Cuenta de prueba creada en banco-m', 'verified');
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo crear la cuenta', 'error');
      return false;
    }
  };

  const copyToClipboard = (text: string, label?: string) => {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => {});
    showToast(label ? `${label} copiado` : 'Dato copiado', 'content_copy');
  };

  const toggleBalanceVisibility = () => setIsBalanceHidden((prev) => !prev);

  const formatCurrency = (amount: number, currency: 'ARS' | 'USD' = 'ARS') => {
    if (isBalanceHidden) return '••••••••••';
    const formatted = Math.abs(amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return currency === 'USD' ? `U$S ${formatted}` : `$ ${formatted}`;
  };

  const downloadCbuPdf = (account?: Account) => {
    const acc = account || accounts[0];
    if (!acc) return;
    const content = [
      'BOREAL BANCO DIGITAL — CUENTA DE PRUEBA',
      `Titular: ${user.name}`,
      `CUIT: ${cuit}`,
      `CBU: ${acc.cbu}`,
      `Alias: ${acc.alias}`,
      'Integrado con banco-m · Entorno educativo',
    ].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    link.download = 'datos-bancarios-boreal.txt';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const shareWhatsApp = (account?: Account) => {
    const acc = account || accounts[0];
    if (!acc) return;
    const text = encodeURIComponent(`Datos de mi cuenta Boreal de prueba\nTitular: ${user.name}\nCBU: ${acc.cbu}\nAlias: ${acc.alias}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const sendTransfer = async (originAccountId: string, recipient: string, amount: number, concept: string) => {
    const origin = accounts.find((account) => account.id === originAccountId);
    if (!origin || !cuit) {
      showToast('No se encontró la cuenta de origen', 'error');
      return false;
    }
    const destination = recipient.trim();
    const digits = normalizeCuit(destination);
    const isNumericIdentifier = /^[\d\s.-]+$/.test(destination);
    const destinationPayload = isNumericIdentifier && digits.length === 22
      ? { destinoCBU: digits }
      : isNumericIdentifier && digits.length === 11
        ? { destinoCuit: digits }
        : { destinoAlias: destination };
    try {
      const transfer = await bankApi.createTransfer({
        origenCuit: cuit,
        monto: Number(amount.toFixed(2)),
        descripcion: concept.trim() || 'Transferencia desde Boreal',
        ...destinationPayload,
      });
      await refreshBankData();
      showToast(`Transferencia confirmada por banco-m · ${transfer.id}`, 'check_circle');
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo completar la transferencia', 'error');
      return false;
    }
  };

  const payService = async (originAccountId: string, serviceName: string, amount: number, identifier: string) => {
    const account = accounts.find((item) => item.id === originAccountId);
    if (!account || !cuit) {
      showToast('No se encontró la cuenta de origen', 'error');
      return false;
    }
    try {
      await bankApi.debit({
        cuit,
        monto: Number(amount.toFixed(2)),
        descripcion: `Débito registrado para ${serviceName}`,
        origen: 'OTRO',
        referencia: identifier,
      });
      await refreshBankData();
      showToast('Débito registrado en el banco. La liquidación externa del servicio no está conectada.', 'info');
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo registrar el débito', 'error');
      return false;
    }
  };

  const depositFunds = async (accountId: string, amount: number) => {
    if (!accounts.some((item) => item.id === accountId) || !cuit) {
      showToast('No se encontró la cuenta de destino', 'error');
      return false;
    }
    try {
      await bankApi.deposit({
        cuit,
        monto: Number(amount.toFixed(2)),
        descripcion: 'Depósito de prueba desde Boreal',
        origen: 'DEPOSITO',
        referencia: `BOREAL-${Date.now()}`,
      });
      await refreshBankData();
      showToast('Depósito registrado en banco-m', 'add_circle');
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo registrar el depósito', 'error');
      return false;
    }
  };

  const createQr = async (
    destination: string,
    destinationType: 'CUIT' | 'CBU',
    type: 'COMERCIO' | 'ARCA' | 'ARBA' | 'MUNICIPALIDAD',
    amount: number,
    description: string,
    reference: string,
  ) => {
    const digits = normalizeCuit(destination);
    try {
      return await bankApi.createQr({
        ...(destinationType === 'CBU' ? { cbuDestino: digits } : { cuitDestino: digits }),
        tipoOrigen: type,
        monto: Number(amount.toFixed(2)),
        descripcion: description.trim() || undefined,
        referencia: reference.trim() || undefined,
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo generar el QR', 'error');
      return null;
    }
  };

  const registerCommerce = async () => {
    if (!cuit) return false;
    try {
      await bankApi.createCommerce(cuit, user.name);
      showToast('Tu cuenta quedó registrada como comercio en banco-m', 'storefront');
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo registrar el comercio', 'error');
      return false;
    }
  };

  const payQr = async (pagoId: string) => {
    if (!cuit) return false;
    try {
      const payment = await bankApi.payQr(pagoId, cuit);
      await refreshBankData();
      showToast(`Pago QR ${payment.estado.toLowerCase()} · ${payment.transferenciaId}`, 'check_circle');
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo pagar el QR', 'error');
      return false;
    }
  };

  const getQrStatus = async (pagoId: string) => {
    try {
      return await bankApi.getQrStatus(pagoId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo consultar el estado del QR', 'error');
      return null;
    }
  };

  const resetSandboxData = () => {
    refreshBankData().then(() => showToast('Datos actualizados desde banco-m', 'sync'))
      .catch((error: unknown) => showToast(error instanceof Error ? error.message : 'No se pudieron actualizar los datos', 'error'));
  };

  const logout = () => {
    localStorage.removeItem(CUIT_STORAGE_KEY);
    setCuit('');
    setAccounts([]);
    setTransactions([]);
    setIsAuthenticated(false);
    setSelectedTransaction(null);
    showToast('Cuenta desconectada', 'logout');
  };

  return (
    <BankingContext.Provider value={{
      isAuthenticated, isInitializing, login, registerAccount, logout, user, cuit,
      accounts, transactions, activeTab, setActiveTab, isBalanceHidden,
      toggleBalanceVisibility, toast, showToast, copyToClipboard, selectedTransaction,
      setSelectedTransaction, isTransferModalOpen, setIsTransferModalOpen,
      isPayServiceModalOpen, setIsPayServiceModalOpen, isDepositModalOpen,
      setIsDepositModalOpen, isQrModalOpen, setIsQrModalOpen, isNotificationsOpen,
      setIsNotificationsOpen, isCbuSheetOpen, setIsCbuSheetOpen, downloadCbuPdf,
      shareWhatsApp, sendTransfer, payService, depositFunds, createQr, registerCommerce, payQr,
      getQrStatus, refreshBankData, resetSandboxData, formatCurrency,
    }}>
      {children}
    </BankingContext.Provider>
  );
};

export const useBanking = () => {
  const context = useContext(BankingContext);
  if (!context) throw new Error('useBanking must be used within a BankingProvider');
  return context;
};
