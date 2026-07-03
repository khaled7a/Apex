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

export interface QueueRow extends OrderSummary {
  customer_id: string;
  category?: string;
}

export interface OrderRow {
  id: string;
  current_state: string;
  hold_type: string;
  state_version: number;
  customer_id: string;
  registered_supplier_id: string | null;
  external_supplier_id: string | null;
  fob_value_usd: string | null;
  final_value_sar: string | null;
  fx_rate_used: string | null;
  fx_rate_deviation_flag: boolean;
  fx_rate_deviation_approved_at: string | null;
}

export interface CustomerInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
  company_name: string | null;
  cr_number: string | null;
}

export interface SupplierInfo {
  id: string;
  legal_name: string;
  contact_email: string | null;
  whatsapp_phone: string | null;
}

export interface ExternalSupplierInfo {
  id: string;
  legal_name: string;
  license_number: string | null;
  years_active: number | null;
  verification_source: string | null;
  vetting_status: string;
}

export interface OfferRow {
  id: string;
  registered_supplier_id: string;
  fob_value_usd: string;
  lead_time_days: number | null;
  terms: string | null;
  submitted_at: string;
}

export interface TimelineEntry {
  id: string;
  from_state: string | null;
  to_state: string;
  event: string;
  acted_by_role: string;
  entered_at: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actor_id: string | null;
  actor_role: string;
  occurred_at: string;
  state_before: unknown;
  state_after: unknown;
}

export interface PaymentInstallment {
  id: string;
  label: string;
  sequence_no: number;
  expected_amount_sar: string;
  is_trust_fund: boolean;
  unique_payment_reference: string;
}

export interface PaymentRow {
  id: string;
  installment_id: string;
  amount_sar: string;
  current_refundability_status: string;
}

export interface ReceiptRow {
  id: string;
  payment_id: string;
  file_url: string;
  verified_at: string | null;
}

export interface ProductionUpdate {
  id: string;
  kind: string;
  content: string | null;
  file_url: string | null;
  posted_by: string;
  posted_at: string;
}

export interface ShippingDocument {
  id: string;
  doc_type: string;
  file_url: string;
  uploaded_at: string;
}

export interface CustomsFee {
  id: string;
  label: string;
  amount_sar: string;
  status: string;
  created_by: string;
  approved_by: string | null;
}

export interface DisputeRow {
  id: string;
  type: string;
  status: string;
  opened_at: string;
  resolved_at: string | null;
}

export interface DisputeClaim {
  id: string;
  description: string;
  raised_by: string;
}

export interface EscalationRow {
  id: string;
  actor: string;
  resolved_at: string | null;
  outcome: string | null;
}

export interface RenewalRow {
  id: string;
  supplier_decision: string;
  admin_decision: string;
}

export interface FinancialApproval {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  submitter_id: string;
  approver_id: string;
  submitted_at: string;
  approved_at: string | null;
}

export interface OrderDetail {
  order: OrderRow;
  customer: CustomerInfo;
  registeredSupplier?: SupplierInfo;
  externalSupplier?: ExternalSupplierInfo;
  offers: OfferRow[];
  contract?: { id: string; signed_at: string | null };
  paymentPlan?: { id: string; total_installments: number };
  installments: PaymentInstallment[];
  payments: PaymentRow[];
  receipts: ReceiptRow[];
  productionUpdates: ProductionUpdate[];
  shippingDocuments: ShippingDocument[];
  customsFees: CustomsFee[];
  disputes: DisputeRow[];
  disputeClaims: DisputeClaim[];
  escalations: EscalationRow[];
  renewals: RenewalRow[];
  timeline: TimelineEntry[];
  financialApprovals: FinancialApproval[];
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail> {
  try {
    return await apiFetch<OrderDetail>(`/orders/${orderId}/detail-for-admin`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function getAuditLog(orderId: string): Promise<AuditLogEntry[]> {
  return apiFetch<AuditLogEntry[]>(`/orders/${orderId}/audit-log`);
}

export interface ListAllResult {
  rows: OrderSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listAll(params: { state?: string; page?: number; pageSize?: number } = {}): Promise<ListAllResult> {
  const query = new URLSearchParams();
  if (params.state) query.set('state', params.state);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  return apiFetch<ListAllResult>(`/orders${qs ? `?${qs}` : ''}`);
}

export async function listNeedsAdminAction(): Promise<QueueRow[]> {
  return apiFetch<QueueRow[]>('/orders/queue/needs-admin-action');
}
