'use server';

import { redirect } from 'next/navigation';
import { tryAuthFetch } from '@/lib/api';
import { ssoUrl, PortalRole } from '@/lib/portals';

type SessionResponse = { token: string; refreshToken: string; ssoCode: string };

export type LoginFormState =
  | { status: 'error'; message: string }
  | { status: 'choose'; options: { role: PortalRole; url: string }[] }
  | undefined;

/**
 * The 3 portals live on 3 separate origins with no shared cookie domain, so
 * there is no single password check that "logs in everywhere" — instead
 * this tries the real login endpoint for all three actor types with the
 * same credentials (server-to-server, never exposing which ones failed)
 * and hands off into whichever one(s) actually matched. Same email can
 * legitimately match more than one role (e.g. an account used to test all
 * three portals) — in that case the user picks explicitly instead of
 * guessing for them.
 */
export async function unifiedLogin(_prevState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const [customer, supplier, admin] = await Promise.all([
    tryAuthFetch<SessionResponse>('/auth/customer/login', { email, password }),
    tryAuthFetch<SessionResponse>('/auth/supplier/login', { email, password }),
    tryAuthFetch<SessionResponse>('/auth/admin/login', { email, password }),
  ]);

  const matches: { role: PortalRole; code: string }[] = [];
  if (customer.ok) matches.push({ role: 'CUSTOMER', code: customer.data.ssoCode });
  if (supplier.ok) matches.push({ role: 'SUPPLIER', code: supplier.data.ssoCode });
  if (admin.ok) matches.push({ role: 'ADMIN', code: admin.data.ssoCode });

  if (matches.length === 0) {
    return { status: 'error', message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
  }
  if (matches.length === 1) {
    redirect(ssoUrl(matches[0].role, matches[0].code));
  }
  return { status: 'choose', options: matches.map((m) => ({ role: m.role, url: ssoUrl(m.role, m.code) })) };
}

/** Only ever CUSTOMER — suppliers/admins are never self-registered, so there is no ambiguity to hand off here. */
export async function registerCustomer(_prevState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const name = String(formData.get('name') ?? '');
  const email = String(formData.get('email') ?? '');
  const phone = String(formData.get('phone') ?? '');
  const password = String(formData.get('password') ?? '');
  const companyName = String(formData.get('companyName') ?? '') || undefined;

  const result = await tryAuthFetch<SessionResponse>('/auth/customer/register', { name, email, phone, password, companyName });
  if (!result.ok) {
    if (result.status === 409) return { status: 'error', message: 'يوجد حساب مسجَّل بهذا البريد الإلكتروني بالفعل' };
    if (result.status === 400) return { status: 'error', message: 'يرجى التحقق من صحة البيانات المُدخلة' };
    return { status: 'error', message: 'تعذّر إنشاء الحساب، حاول مرة أخرى' };
  }
  redirect(ssoUrl('CUSTOMER', result.data.ssoCode));
}
