'use server';

import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { describeApiError, formInt, formString, type ActionState } from '@/lib/action-helpers';

export async function selectOffer(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  const offerId = formString(formData, 'offerId');
  const expectedStateVersion = formInt(formData, 'expectedStateVersion');
  try {
    await apiFetch(`/bidding/${orderId}/select/${offerId}`, { method: 'POST', body: { expectedStateVersion } });
  } catch (err) {
    return describeApiError(err, 'تعذّر اختيار هذا العرض');
  }
  redirect(`/orders/${orderId}`);
}

export async function rejectAllOffers(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  const expectedStateVersion = formInt(formData, 'expectedStateVersion');
  try {
    await apiFetch(`/bidding/${orderId}/reject-all`, { method: 'POST', body: { expectedStateVersion } });
  } catch (err) {
    return describeApiError(err, 'تعذّر رفض العروض');
  }
  redirect(`/orders/${orderId}`);
}
