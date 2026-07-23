'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { describeApiError, formInt, formString, type ActionState } from '@/lib/action-helpers';

export async function approveCheckpoint(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  const expectedStateVersion = formInt(formData, 'expectedStateVersion');
  try {
    await apiFetch(`/production/${orderId}/approve`, { method: 'POST', body: { expectedStateVersion } });
  } catch (err) {
    return describeApiError(err, 'تعذّر اعتماد هذه المرحلة');
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function rejectCheckpoint(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  const expectedStateVersion = formInt(formData, 'expectedStateVersion');
  const reason = formString(formData, 'reason');
  if (!reason.trim()) {
    return { error: 'يرجى كتابة سبب الرفض' };
  }
  try {
    await apiFetch(`/production/${orderId}/reject`, { method: 'POST', body: { expectedStateVersion, reason } });
  } catch (err) {
    return describeApiError(err, 'تعذّر رفض هذه المرحلة');
  }
  revalidatePath(`/orders/${orderId}`);
}
