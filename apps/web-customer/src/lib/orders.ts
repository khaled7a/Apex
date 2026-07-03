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
  customer_id: string;
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

export interface Payment {
  id: string;
  installment_id: string;
  amount_sar: string;
  paid_at: string | null;
}

export interface CustomsFee {
  id: string;
  label: string;
  amount_sar: string;
  status: string;
}

export interface ProductionUpdate {
  id: string;
  kind: string;
  content: string | null;
  file_url: string | null;
  posted_by: string;
  posted_at: string;
}

export interface OrderDetail {
  order: OrderRow;
  contract?: { id: string; signed_at: string | null };
  paymentPlan?: { id: string; total_installments: number };
  installments: PaymentInstallment[];
  payments: Payment[];
  receipts: { id: string; payment_id: string; rejection_reason: string | null }[];
  productionUpdates: ProductionUpdate[];
  shippingDocuments: { id: string; doc_type: string; file_url: string; uploaded_at: string }[];
  customsFees: CustomsFee[];
  disputes: { id: string; type: string; status: string; opened_at: string }[];
  disputeClaims: { id: string; description: string; raised_by: string }[];
  escalations: { id: string; actor: string; resolved_at: string | null }[];
  renewals: { id: string; supplier_decision: string; admin_decision: string }[];
  timeline: TimelineEntry[];
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail> {
  try {
    return await apiFetch<OrderDetail>(`/orders/${orderId}/detail`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function listMyOrders(): Promise<OrderSummary[]> {
  return apiFetch<OrderSummary[]>('/orders/me');
}

export interface CustomerOffer {
  id: string;
  fob_value_usd: string;
  lead_time_days: number | null;
  terms: string | null;
  supplierLabel: string;
}

export async function listOffersForCustomer(orderId: string): Promise<CustomerOffer[]> {
  return apiFetch<CustomerOffer[]>(`/bidding/${orderId}/offers/customer-view`);
}
