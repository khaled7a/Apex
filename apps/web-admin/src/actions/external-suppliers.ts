'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { describeApiError, formInt, formString, type ActionState } from '@/lib/action-helpers';

export async function createExternalSupplier(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/orders/${orderId}/external-supplier`, {
      method: 'POST',
      body: {
        legalName: formString(formData, 'legalName'),
        licenseNumber: formString(formData, 'licenseNumber') || undefined,
        yearsActive: formData.get('yearsActive') ? Number(formData.get('yearsActive')) : undefined,
        verificationSource: formString(formData, 'verificationSource') || undefined,
      },
    });
  } catch (err) {
    return describeApiError(err, 'تعذّر تسجيل بيانات المورد الخارجي');
  }
  revalidatePath(`/orders/${orderId}/vetting`);
}

export async function proposeVettingApproval(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/orders/${orderId}/external-supplier/vetting/propose-approval`, { method: 'POST', body: { approverId: formString(formData, 'approverId') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}/vetting`);
}

export async function approveVetting(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/orders/${orderId}/external-supplier/vetting/approve`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function rejectVetting(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/orders/${orderId}/external-supplier/vetting/reject`, { method: 'POST', body: { expectedStateVersion: formInt(formData, 'expectedStateVersion') } });
  } catch (err) {
    return describeApiError(err);
  }
  revalidatePath(`/orders/${orderId}`);
}
