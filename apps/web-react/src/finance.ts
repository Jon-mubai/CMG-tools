import { api } from '@/api/client';

export type FinRecord = {
  id: string;
  item?: string;
  purpose?: string;
  description?: string;
  qty?: number;
  amount?: number;
  dateStart?: string;
  dateEnd?: string;
  userName?: string;
  auditor?: string;
  payType?: string;
  ticketType?: string;
  inboundNo?: string;
  remark?: string;
  reviewStatus?: string;
  createdAt?: string;
  deleted?: boolean;
  payImages?: string[];
  invoiceImages?: string[];
  otherImages?: string[];
};

export type FinSource = {
  id: string;
  name?: string;
  amount?: number;
  payer?: string;
  receiver?: string;
  start?: string;
  end?: string;
  deleted?: boolean;
};

export type FinLedger = {
  reserve: number;
  reservePeriods: { id?: string; amount?: number; start?: string; end?: string }[];
  records: FinRecord[];
  sources: FinSource[];
  updatedAt?: string | null;
};

export async function loadLedger(token: string | null): Promise<FinLedger> {
  const data = await api.get<FinLedger>('/api/v1/finance/ledger', token);
  return {
    reserve: Number(data?.reserve) || 0,
    reservePeriods: Array.isArray(data?.reservePeriods) ? data.reservePeriods : [],
    records: Array.isArray(data?.records) ? data.records : [],
    sources: Array.isArray(data?.sources) ? data.sources : [],
    updatedAt: data?.updatedAt || null,
  };
}

export async function saveLedger(token: string | null, ledger: FinLedger) {
  return api.put('/api/v1/finance/ledger', ledger, token);
}

export function money(n: number) {
  return `¥${(Number(n) || 0).toFixed(2)}`;
}
