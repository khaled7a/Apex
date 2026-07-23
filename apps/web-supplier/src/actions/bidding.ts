'use server';

import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { describeApiError, formString, type ActionState } from '@/lib/action-helpers';

export async function submitOffer(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  const fobValueUsd = Number(formData.get('fobValueUsd'));
  const leadTimeDaysRaw = formData.get('leadTimeDays');
  const leadTimeDays = leadTimeDaysRaw ? Number(leadTimeDaysRaw) : undefined;
  const terms = formString(formData, 'terms') || undefined;

  try {
    await apiFetch(`/bidding/${orderId}/offers`, { method: 'POST', body: { fobValueUsd, leadTimeDays, terms } });
  } catch (err) {
    return describeApiError(err, 'تعذّر إرسال العرض');
  }
  redirect('/dashboard');
}
