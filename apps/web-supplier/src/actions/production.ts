'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, uploadFile } from '@/lib/api';
import { describeApiError, formInt, formString, type ActionState } from '@/lib/action-helpers';

async function uploadProductionUpdate(path: string, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  const expectedStateVersion = formInt(formData, 'expectedStateVersion');
  const content = formString(formData, 'content') || undefined;
  const file = formData.get('file');

  let fileUrl: string | undefined;
  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadFile(orderId, file);
    fileUrl = uploaded.url;
  }
  if (!content && !fileUrl) {
    return { error: 'أرفق ملفاً أو اكتب وصفاً على الأقل' };
  }

  try {
    await apiFetch(`/production/${orderId}/${path}`, { method: 'POST', body: { kind: fileUrl ? 'image' : 'text', content, fileUrl, expectedStateVersion } });
  } catch (err) {
    return describeApiError(err, 'تعذّر رفع التحديث');
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function uploadDesign(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  return uploadProductionUpdate('design', formData);
}

export async function uploadQc(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  return uploadProductionUpdate('qc', formData);
}

/**
 * One endpoint on the backend handles both re-submission cases —
 * production.service.ts's resubmit() picks supplier_resubmits vs
 * supplier_resubmits_qc based on the order's current_state itself, so the
 * frontend doesn't need to know which checkpoint was rejected either.
 */
export async function resubmit(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  return uploadProductionUpdate('resubmit', formData);
}
