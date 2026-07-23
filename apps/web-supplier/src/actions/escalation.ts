'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { describeApiError, formInt, formString, type ActionState } from '@/lib/action-helpers';

export async function supplierResponds(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  const expectedStateVersion = formInt(formData, 'expectedStateVersion');
  try {
    await apiFetch(`/escalation/${orderId}/supplier-responds`, { method: 'POST', body: { expectedStateVersion } });
  } catch (err) {
    return describeApiError(err, 'تعذّر إرسال ردّك');
  }
  revalidatePath(`/orders/${orderId}`);
}
