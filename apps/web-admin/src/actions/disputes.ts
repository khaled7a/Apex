'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { describeApiError, formInt, formString, type ActionState } from '@/lib/action-helpers';

export async function openDisputeAsAdmin(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/disputes/${orderId}/open/admin`, {
      method: 'POST',
      body: { event: formString(formData, 'event'), expectedStateVersion: formInt(formData, 'expectedStateVersion') },
    });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function resolveOrdinaryDispute(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/disputes/${orderId}/resolve`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function markUnresolved(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/disputes/${orderId}/mark-unresolved`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function adminCancelOrder(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/disputes/${orderId}/admin-cancel`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function proposeMandatoryRefund(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/disputes/${orderId}/mandatory-refund/propose`, { method: 'POST', body: { approverId: formString(formData, 'approverId') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}/mandatory-refund`);
}

export async function approveMandatoryRefund(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/disputes/${orderId}/mandatory-refund/approve`, {
      method: 'POST',
      body: {
        expectedStateVersion: formInt(formData, 'expectedStateVersion'),
        paymentId: formString(formData, 'paymentId'),
        refundedAmountSar: Number(formData.get('refundedAmountSar')),
        refundRatio: Number(formData.get('refundRatio')),
        reason: formString(formData, 'reason'),
      },
    });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}
