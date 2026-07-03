'use server';

import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { setSessionCookie, clearSessionCookie } from '@/lib/session';

export type AuthFormState = { error: string } | undefined;

export async function login(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  let token: string;
  try {
    const result = await apiFetch<{ token: string }>('/auth/customer/login', { method: 'POST', body: { email, password }, token: null });
    token = result.token;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
    }
    return { error: 'تعذّر تسجيل الدخول، حاول مرة أخرى' };
  }

  await setSessionCookie(token);
  redirect('/dashboard');
}

export async function register(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const name = String(formData.get('name') ?? '');
  const email = String(formData.get('email') ?? '');
  const phone = String(formData.get('phone') ?? '');
  const password = String(formData.get('password') ?? '');
  const companyName = String(formData.get('companyName') ?? '') || undefined;

  let token: string;
  try {
    const result = await apiFetch<{ token: string }>('/auth/customer/register', {
      method: 'POST',
      body: { name, email, phone, password, companyName },
      token: null,
    });
    token = result.token;
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      return { error: 'يوجد حساب مسجَّل بهذا البريد الإلكتروني بالفعل' };
    }
    if (err instanceof ApiError && err.status === 400) {
      return { error: 'يرجى التحقق من صحة البيانات المُدخلة' };
    }
    return { error: 'تعذّر إنشاء الحساب، حاول مرة أخرى' };
  }

  await setSessionCookie(token);
  redirect('/dashboard');
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect('/login');
}
