'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { describeApiError, formString, type ActionState } from '@/lib/action-helpers';

export async function createAdmin(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await apiFetch('/admin/admins', {
      method: 'POST',
      body: {
        name: formString(formData, 'name'),
        email: formString(formData, 'email'),
        password: formString(formData, 'password'),
        role: formString(formData, 'role'),
      },
    });
  } catch (err) {
    return describeApiError(err, 'تعذّر إنشاء حساب الإدارة');
  }
  revalidatePath('/accounts');
}

export async function createSupplier(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await apiFetch('/admin/suppliers', {
      method: 'POST',
      body: {
        legalName: formString(formData, 'legalName'),
        contactEmail: formString(formData, 'contactEmail'),
        password: formString(formData, 'password'),
        whatsappPhone: formString(formData, 'whatsappPhone') || undefined,
      },
    });
  } catch (err) {
    return describeApiError(err, 'تعذّر تسجيل المورد');
  }
  revalidatePath('/accounts');
}

export async function deactivateAdmin(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await apiFetch(`/admin/admins/${formString(formData, 'id')}/deactivate`, { method: 'POST' });
  } catch (err) {
    return describeApiError(err, 'تعذّر تعطيل الحساب');
  }
  revalidatePath('/accounts');
}

export async function reactivateAdmin(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await apiFetch(`/admin/admins/${formString(formData, 'id')}/reactivate`, { method: 'POST' });
  } catch (err) {
    return describeApiError(err, 'تعذّر إعادة تفعيل الحساب');
  }
  revalidatePath('/accounts');
}

export async function deactivateSupplier(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await apiFetch(`/admin/suppliers/${formString(formData, 'id')}/deactivate`, { method: 'POST' });
  } catch (err) {
    return describeApiError(err, 'تعذّر تعطيل حساب المورد');
  }
  revalidatePath('/accounts');
}

export async function reactivateSupplier(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await apiFetch(`/admin/suppliers/${formString(formData, 'id')}/reactivate`, { method: 'POST' });
  } catch (err) {
    return describeApiError(err, 'تعذّر إعادة تفعيل حساب المورد');
  }
  revalidatePath('/accounts');
}
