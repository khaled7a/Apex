'use server';

import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { describeApiError, formInt, formString, type ActionState } from '@/lib/action-helpers';

export async function openDispute(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  const expectedStateVersion = formInt(formData, 'expectedStateVersion');
  const event = formString(formData, 'event');
  try {
    await apiFetch(`/disputes/${orderId}/open/supplier`, { method: 'POST', body: { event, expectedStateVersion } });
  } catch (err) {
    return describeApiError(err, 'تعذّر فتح النزاع');
  }
  redirect(`/orders/${orderId}`);
}
