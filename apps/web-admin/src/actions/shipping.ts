'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, uploadFile } from '@/lib/api';
import { describeApiError, formInt, formString, type ActionState } from '@/lib/action-helpers';

export async function completeLogisticsSetup(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/shipping/${orderId}/logistics-setup-complete`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function advanceToDocs(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/shipping/${orderId}/advance-to-docs`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function addDocument(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'أرفق ملفاً' };
  }
  try {
    const uploaded = await uploadFile(orderId, file);
    await apiFetch(`/shipping/${orderId}/documents`, { method: 'POST', body: { docType: formString(formData, 'docType'), fileUrl: uploaded.url } });
  } catch (err) {
    return describeApiError(err, 'تعذّر رفع المستند');
  }
  revalidatePath(`/orders/${orderId}/logistics`);
}

export async function finalizeDocsUploaded(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/shipping/${orderId}/documents/finalize`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function markArrived(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/shipping/${orderId}/arrived`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}
