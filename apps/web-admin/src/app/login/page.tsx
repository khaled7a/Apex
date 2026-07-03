'use client';

import { useActionState } from 'react';
import { login } from '@/actions/auth';
import { FormError } from '@/components/FormError';
import { SubmitButton } from '@/components/SubmitButton';

export default function LoginPage() {
  const [state, formAction] = useActionState(login, undefined);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-center text-2xl font-bold text-emerald-800">إيبيكس سورس — بوابة الإدارة</h1>
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
        <FormError message={state?.error} />
        <SubmitButton className="w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60">
          دخول
        </SubmitButton>
        <p className="text-center text-xs text-slate-500">
          <a href="/forgot-password" className="hover:text-emerald-700">نسيت كلمة المرور؟</a>
        </p>
      </form>
    </div>
  );
}
