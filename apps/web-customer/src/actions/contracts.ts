'use server';

import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { describeApiError, formInt, formString, type ActionState } from '@/lib/action-helpers';

export async function signContract(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  const expectedStateVersion = formInt(formData, 'expectedStateVersion');
  const signatureRef = formString(formData, 'signatureRef');
  try {
    await apiFetch(`/contracts/${orderId}/sign`, { method: 'POST', body: { expectedStateVersion, signatureRef } });
  } catch (err) {
    return describeApiError(err, 'تعذّر توقيع العقد');
  }
  redirect(`/orders/${orderId}`);
}
