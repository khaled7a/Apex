import { apiFetch } from './api';

export interface AdminProfile {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'OPERATOR' | 'ACCOUNTANT';
  is_active: boolean;
}

export interface AdminAccount extends AdminProfile {
  mfa_enabled: boolean;
  created_at: string;
}

export interface SupplierAccount {
  id: string;
  legal_name: string;
  contact_email: string | null;
  whatsapp_phone: string | null;
  is_active: boolean;
  created_at: string;
}

export async function getMe(): Promise<AdminProfile> {
  return apiFetch<AdminProfile>('/auth/admin/me');
}

export async function listAdmins(): Promise<AdminAccount[]> {
  return apiFetch<AdminAccount[]>('/admin/admins');
}

export async function listSuppliers(): Promise<SupplierAccount[]> {
  return apiFetch<SupplierAccount[]>('/admin/suppliers');
}
