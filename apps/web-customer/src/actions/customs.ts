'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, uploadFile } from '@/lib/api';
import { describeApiError, formInt, formString, type ActionState } from '@/lib/action-helpers';

export async function payAndUploadProof(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  const expectedStateVersion = formInt(formData, 'expectedStateVersion');
  const file = formData.get('file');

  if (!(file instanceof File) || file.size === 0) {
    return { error: 'يرجى إرفاق إثبات الدفع' };
  }

  try {
    const uploaded = await uploadFile(orderId, file);
    await apiFetch(`/customs-fees/${orderId}/pay-and-upload-proof`, {
      method: 'POST',
      body: { expectedStateVersion, fileUrl: uploaded.url },
    });
  } catch (err) {
    return describeApiError(err, 'تعذّر رفع إثبات دفع الرسوم');
  }
  revalidatePath(`/orders/${orderId}`);
}
