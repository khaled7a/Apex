'use server';

import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { formString, type ActionState } from '@/lib/action-helpers';

export type ForgotPasswordState = { success: true } | undefined;

/** Always the same response regardless of whether the email matched an account — no signal to leak which emails exist. */
export async function forgotPassword(_prevState: ForgotPasswordState, formData: FormData): Promise<ForgotPasswordState> {
  try {
    await apiFetch('/auth/admin/forgot-password', { method: 'POST', body: { email: formString(formData, 'email') }, token: null });
  } catch {
    // Intentionally ignored — the endpoint itself never signals failure for this reason.
  }
  return { success: true };
}

export async function resetPassword(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await apiFetch('/auth/admin/reset-password', {
      method: 'POST',
      body: { token: formString(formData, 'token'), newPassword: formString(formData, 'newPassword') },
      token: null,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 400) {
      return { error: 'رمز إعادة التعيين غير صالح أو منتهي الصلاحية' };
    }
    return { error: 'تعذّر إعادة تعيين كلمة المرور، حاول مرة أخرى' };
  }
  redirect('/login');
}
