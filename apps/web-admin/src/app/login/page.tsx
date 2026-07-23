'use client';

import { useActionState } from 'react';
import { LogIn } from 'lucide-react';
import { login } from '@/actions/auth';
import { Logo } from '@/components/Logo';
import { FormError } from '@/components/FormError';
import { SubmitButton } from '@/components/SubmitButton';

export default function LoginPage() {
  const [state, formAction] = useActionState(login, undefined);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="mb-6">
        <Logo className="text-xl text-emerald-800" suffix="الإدارة" />
      </div>
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <LogIn className="h-4.5 w-4.5" strokeWidth={2} />
          </span>
          تسجيل الدخول
        </h1>
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
