import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from './api';

export interface OrderSummary {
  id: string;
  service_type_id: string;
  current_state: string;
  hold_type: string;
  created_at: string;
  final_value_sar: string | null;
}

export interface OrderRow {
  id: string;
  current_state: string;
  hold_type: string;
  state_version: number;
  registered_supplier_id: string | null;
  fob_value_usd: string | null;
  final_value_sar: string | null;
}

export interface TimelineEntry {
  id: string;
  from_state: string | null;
  to_state: string;
  event: string;
  acted_by_role: string;
  entered_at: string;
}

export interface PaymentInstallment {
  id: string;
  label: string;
  sequence_no: number;
  expected_amount_sar: string;
  is_trust_fund: boolean;
}

export interface ProductionUpdate {
  id: string;
  kind: string;
  content: string | null;
  file_url: string | null;
  posted_by: string;
  posted_at: string;
}

export interface Escalation {
  id: string;
  actor: string;
  resolved_at: string | null;
}

export interface OrderDetail {
  order: OrderRow;
  contract?: { id: string; signed_at: string | null };
  paymentPlan?: { id: string; total_installments: number };
  installments: PaymentInstallment[];
  productionUpdates: ProductionUpdate[];
  disputes: { id: string; type: string; status: string; opened_at: string }[];
  disputeClaims: { id: string; description: string; raised_by: string }[];
  escalations: Escalation[];
  renewals: { id: string; supplier_decision: string; admin_decision: string }[];
  timeline: TimelineEntry[];
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail> {
  try {
    return await apiFetch<OrderDetail>(`/orders/${orderId}/detail-for-supplier`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function listAssignedToMe(): Promise<OrderSummary[]> {
  return apiFetch<OrderSummary[]>('/orders/assigned-to-me');
}

export interface BiddingBoardRow {
  order_id: string;
  serviceTypeLabel: string;
  fob_value_usd: string | null;
  created_at: string;
}

export async function listBiddingBoard(): Promise<BiddingBoardRow[]> {
  return apiFetch<BiddingBoardRow[]>('/bidding/board');
}
