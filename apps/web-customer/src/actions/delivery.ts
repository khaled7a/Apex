'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { describeApiError, formInt, formString, type ActionState } from '@/lib/action-helpers';

export async function signDelivery(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  const expectedStateVersion = formInt(formData, 'expectedStateVersion');
  try {
    await apiFetch(`/delivery/${orderId}/sign`, { method: 'POST', body: { expectedStateVersion } });
  } catch (err) {
    return describeApiError(err, 'تعذّر تأكيد الاستلام');
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function rateSupplier(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  const expectedStateVersion = formInt(formData, 'expectedStateVersion');
  const score = formInt(formData, 'score');
  const notes = formString(formData, 'notes') || undefined;
  try {
    await apiFetch(`/ratings/${orderId}`, { method: 'POST', body: { expectedStateVersion, score, notes } });
  } catch (err) {
    return describeApiError(err, 'تعذّر إرسال التقييم');
  }
  revalidatePath(`/orders/${orderId}`);
}
