'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { describeApiError, formInt, formString, type ActionState } from '@/lib/action-helpers';

export async function confirmDeposit(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/orders/${orderId}/confirm-deposit`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function requestEdit(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/orders/${orderId}/request-edit`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function rejectOrder(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/orders/${orderId}/reject`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function approveOrder(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  const supplierType = formString(formData, 'supplierType');
  const externalSupplierId = formString(formData, 'externalSupplierId');
  try {
    await apiFetch(`/orders/${orderId}/approve`, {
      method: 'POST',
      body: {
        expectedStateVersion: formInt(formData, 'expectedStateVersion'),
        supplierType: supplierType || undefined,
        externalSupplierId: externalSupplierId || undefined,
      },
    });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}
