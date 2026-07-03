'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { describeApiError, formInt, formString, type ActionState } from '@/lib/action-helpers';

export async function startCustoms(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/customs-fees/${orderId}/start`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function createFee(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/customs-fees/${orderId}/fees`, { method: 'POST', body: { label: formString(formData, 'label'), amountSar: Number(formData.get('amountSar')) } });
  } catch (err) {
    return describeApiError(err, 'تعذّر إنشاء الرسم');
  }
  revalidatePath(`/orders/${orderId}/customs`);
}

/** Variant B four-eyes — no advance proposal, any eligible admin other than the creator may approve directly (see lib/approver-picker.ts's comment). */
export async function approveFee(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  const feeId = formString(formData, 'feeId');
  try {
    await apiFetch(`/customs-fees/${orderId}/fees/${feeId}/approve`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}/customs`);
}

export async function adminVerifiesFee(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/customs-fees/${orderId}/verify`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function rejectProof(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/customs-fees/${orderId}/reject-proof`, {
      method: 'POST',
      body: { reason: formString(formData, 'reason'), expectedStateVersion: formInt(formData, 'expectedStateVersion') },
    });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function addMoreFees(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/customs-fees/${orderId}/add-more-fees`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function noMoreFees(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/customs-fees/${orderId}/no-more-fees`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}
