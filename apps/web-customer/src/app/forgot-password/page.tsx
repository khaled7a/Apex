'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { forgotPassword } from '@/actions/password-reset';
import { SubmitButton } from '@/components/SubmitButton';
import { Logo } from '@/components/Logo';

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState(forgotPassword, undefined);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="mb-6 text-center">
        <Logo className="justify-center text-xl text-emerald-800" />
      </div>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <KeyRound className="h-4.5 w-4.5" strokeWidth={2} />
          </span>
          <h2 className="text-lg font-semibold text-slate-900">نسيت كلمة المرور؟</h2>
        </div>
        {state?.success ? (
          <p className="text-sm text-emerald-700">إن كان البريد الإلكتروني مسجَّلاً لدينا، ستصلك رسالة تحتوي رابط إعادة التعيين خلال دقائق.</p>
        ) : (
          <form action={formAction} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">البريد الإلكتروني</label>
              <input name="email" type="email" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <SubmitButton className="w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60">
              إرسال رابط إعادة التعيين
            </SubmitButton>
          </form>
        )}
        <p className="text-center text-sm text-slate-600">
          <Link href="/login" className="font-medium text-emerald-700 hover:underline">العودة لتسجيل الدخول</Link>
        </p>
      </div>
    </div>
  );
}
