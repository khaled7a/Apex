'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { register } from '@/actions/auth';
import { FormError } from '@/components/FormError';
import { SubmitButton } from '@/components/SubmitButton';

export default function RegisterPage() {
  const [state, formAction] = useActionState(register, undefined);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-8">
      <h1 className="mb-6 text-center text-2xl font-bold text-emerald-800">إيبيكس سورس</h1>
      <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">إنشاء حساب عميل جديد</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">الاسم</label>
          <input name="name" type="text" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">اسم الشركة (اختياري)</label>
          <input name="companyName" type="text" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">رقم الجوال</label>
          <input name="phone" type="tel" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">البريد الإلكتروني</label>
          <input name="email" type="email" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">كلمة المرور (8 أحرف على الأقل)</label>
          <input name="password" type="password" required minLength={8} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <FormError message={state?.error} />
        <SubmitButton className="w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60">
          إنشاء الحساب
        </SubmitButton>
        <p className="text-center text-sm text-slate-600">
          لديك حساب بالفعل؟{' '}
          <Link href="/login" className="font-medium text-emerald-700 hover:underline">
            سجّل الدخول
          </Link>
        </p>
      </form>
    </div>
  );
}
