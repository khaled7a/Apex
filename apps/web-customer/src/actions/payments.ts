'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, uploadFile } from '@/lib/api';
import { describeApiError, formInt, formString, type ActionState } from '@/lib/action-helpers';

export async function notifyTransfer(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  const installmentId = formString(formData, 'installmentId');
  const expectedStateVersion = formInt(formData, 'expectedStateVersion');
  try {
    await apiFetch(`/payments/${orderId}/notify-transfer`, { method: 'POST', body: { installmentId, expectedStateVersion } });
  } catch (err) {
    return describeApiError(err, 'تعذّر إرسال إشعار التحويل');
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function uploadReceipt(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  const paymentId = formString(formData, 'paymentId');
  const expectedStateVersion = formInt(formData, 'expectedStateVersion');
  const bankReferenceNo = formString(formData, 'bankReferenceNo');
  const bankName = formString(formData, 'bankName');
  const amountClaimed = Number(formData.get('amountClaimed'));
  const transferDateClaimed = formString(formData, 'transferDateClaimed');
  const file = formData.get('file');

  if (!(file instanceof File) || file.size === 0) {
    return { error: 'يرجى إرفاق صورة أو ملف الإيصال' };
  }

  try {
    const uploaded = await uploadFile(orderId, file);
    await apiFetch(`/payments/${orderId}/receipts`, {
      method: 'POST',
      body: { paymentId, expectedStateVersion, fileUrl: uploaded.url, bankReferenceNo, bankName, amountClaimed, transferDateClaimed },
    });
  } catch (err) {
    return describeApiError(err, 'تعذّر رفع الإيصال');
  }
  revalidatePath(`/orders/${orderId}`);
}
