const DEFAULT_API_BASE = import.meta.env.DEV ? '/api' : 'http://localhost:3001/api';
const API_BASE = (import.meta.env.VITE_BANK_API_URL || DEFAULT_API_BASE).replace(/\/$/, '');

interface BankEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface BankAccount {
  id: string;
  cuit: string;
  cbu: string;
  alias: string;
  titularNombre: string;
  saldo: number | string;
  activa: boolean;
}

export interface BankMovement {
  id: string;
  cuentaId: string;
  tipo: 'CREDITO' | 'DEBITO';
  monto: number | string;
  descripcion: string | null;
  referencia: string | null;
  origen: string | null;
  saldoAntes: number | string;
  saldoDespues: number | string;
  creadoEn: string;
}

export interface BankQrPayment {
  pagoId: string;
  qrCode: string;
  qrPayload: string;
  monto: number | string;
  destino: string;
  expiresAt: string;
}

export interface BankQrStatus {
  id: string;
  estado: 'PENDIENTE' | 'PROCESANDO' | 'PAGADO' | 'COMPLETADO' | 'EXPIRADO' | 'CANCELADO';
  monto: number | string;
  descripcion: string | null;
  expiresAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new Error('No se pudo conectar con banco-m. Verificá que el servidor esté iniciado.');
  }

  const body = (await response.json().catch(() => null)) as BankEnvelope<T> | null;
  if ([502, 503, 504].includes(response.status)) {
    throw new Error(
      'No se encuentra la API de banco-m en el puerto 3001. Iniciá el backend con "npm run dev" desde la carpeta banco-m.',
    );
  }
  if (!response.ok || !body?.ok || body.data === undefined) {
    throw new Error(body?.error || `Error del banco (HTTP ${response.status})`);
  }
  return body.data;
}

function json(method: 'POST' | 'PATCH', data: unknown): RequestInit {
  return { method, body: JSON.stringify(data) };
}

export const bankApi = {
  getAccount: (cuit: string) => request<BankAccount>(`/cuentas/${encodeURIComponent(cuit)}`),
  createAccount: (cuit: string, titularNombre: string) =>
    request<BankAccount>('/cuentas', json('POST', { cuit, titularNombre })),
  createCommerce: (cuit: string, razonSocial: string, rubro?: string) =>
    request<{ id: string; cuit: string; razonSocial: string; cuentaId: string }>(
      '/comercios',
      json('POST', { cuit, razonSocial, rubro }),
    ),
  getMovements: (accountId: string) =>
    request<{ total: number; page: number; limit: number; items: BankMovement[] }>(
      `/movimientos/${encodeURIComponent(accountId)}?page=1&limit=100`,
    ),
  createTransfer: (data: Record<string, unknown>) =>
    request<{ id: string; estado: string; monto: number | string }>('/transferencias', json('POST', data)),
  deposit: (data: Record<string, unknown>) =>
    request<BankMovement>('/movimientos/deposito', json('POST', data)),
  debit: (data: Record<string, unknown>) =>
    request<BankMovement>('/movimientos/debito', json('POST', data)),
  createQr: (data: Record<string, unknown>) =>
    request<BankQrPayment>('/pagos/qr/generar', json('POST', data)),
  payQr: (pagoId: string, cuitPagador: string) =>
    request<{ pagoId: string; transferenciaId: string; monto: number | string; estado: string }>(
      '/pagos/qr/pagar',
      json('POST', { pagoId, cuitPagador }),
    ),
  getQrStatus: (pagoId: string) =>
    request<BankQrStatus>(`/pagos/qr/estado/${encodeURIComponent(pagoId)}`),
};
