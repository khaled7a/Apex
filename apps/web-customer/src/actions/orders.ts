'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { describeApiError, formInt, formString, type ActionState } from '@/lib/action-helpers';

export async function createOrder(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const serviceTypeCode = formString(formData, 'serviceTypeCode');
  let orderId: string;
  try {
    const order = await apiFetch<{ id: string }>('/orders', { method: 'POST', body: { serviceTypeCode } });
    orderId = order.id;
  } catch (err) {
    return describeApiError(err, 'تعذّر إنشاء الطلب');
  }
  redirect(`/orders/${orderId}`);
}

export async function submitOrder(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  const expectedStateVersion = formInt(formData, 'expectedStateVersion');
  try {
    await apiFetch(`/orders/${orderId}/submit`, { method: 'POST', body: { expectedStateVersion } });
  } catch (err) {
    return describeApiError(err, 'تعذّر تقديم الطلب');
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function resubmitOrder(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  const expectedStateVersion = formInt(formData, 'expectedStateVersion');
  try {
    await apiFetch(`/orders/${orderId}/resubmit`, { method: 'POST', body: { expectedStateVersion } });
  } catch (err) {
    return describeApiError(err, 'تعذّر إعادة تقديم الطلب');
  }
  revalidatePath(`/orders/${orderId}`);
}
