'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { describeApiError, formInt, formString, type ActionState } from '@/lib/action-helpers';

export async function reviewBids(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/bidding/${orderId}/review`, {
      method: 'POST',
      body: {
        expectedStateVersion: formInt(formData, 'expectedStateVersion'),
        fxRateUsed: Number(formData.get('fxRateUsed')),
        fxRateSource: formString(formData, 'fxRateSource'),
        fxReferenceRate: Number(formData.get('fxReferenceRate')),
      },
    });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function approveFxDeviation(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/bidding/${orderId}/fx-deviation/approve`, { method: 'POST', body: {} });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function extendDeadline(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/bidding/${orderId}/extend-deadline`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function cancelBidding(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/bidding/${orderId}/cancel`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function republish(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/bidding/${orderId}/republish`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}
