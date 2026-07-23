'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { unifiedLogin } from '@/actions/auth';
import { FormError } from '@/components/FormError';
import { SubmitButton } from '@/components/SubmitButton';
import { PORTAL_LABEL } from '@/lib/portals';

export default function LoginPage() {
  const [state, formAction] = useActionState(unifiedLogin, undefined);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-center text-2xl font-bold text-emerald-800">إيبيكس سورس</h1>

      {state?.status === 'choose' ? (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">هذا الحساب مسجَّل بأكثر من صفة — اختر أين تريد الدخول</h2>
          <div className="flex flex-col gap-3">
            {state.options.map((option) => (
              <a
                key={option.role}
                href={option.url}
                className="rounded-md bg-emerald-700 px-4 py-2 text-center text-sm font-medium text-white hover:bg-emerald-800"
              >
                الدخول كـ{PORTAL_LABEL[option.role]}
              </a>
            ))}
          </div>
        </div>
      ) : (
        <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">تسجيل الدخول</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">البريد الإلكتروني</label>
            <input name="email" type="email" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">كلمة المرور</label>
            <input name="password" type="password" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <FormError message={state?.status === 'error' ? state.message : undefined} />
          <SubmitButton className="w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60">
            دخول
          </SubmitButton>
          <p className="text-center text-sm text-slate-600">
            ليس لديك حساب؟{' '}
            <Link href="/register" className="font-medium text-emerald-700 hover:underline">
              سجّل كعميل الآن
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
