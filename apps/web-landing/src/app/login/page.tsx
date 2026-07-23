'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { LogIn, Building2, Truck, Package } from 'lucide-react';
import { unifiedLogin } from '@/actions/auth';
import { FormError } from '@/components/FormError';
import { SubmitButton } from '@/components/SubmitButton';
import { Logo } from '@/components/Logo';
import { PORTAL_LABEL } from '@/lib/portals';

const PORTAL_ICON = { CUSTOMER: Package, SUPPLIER: Truck, ADMIN: Building2 } as const;

export default function LoginPage() {
  const [state, formAction] = useActionState(unifiedLogin, undefined);

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-gradient-to-br from-emerald-800 via-emerald-800 to-teal-900 p-10 text-white lg:flex">
        <Logo className="text-lg text-white" />
        <div>
          <h2 className="mb-3 text-2xl font-bold">مرحباً بعودتك</h2>
          <p className="max-w-sm text-sm leading-relaxed text-emerald-50/80">
            دخول واحد يوصلك لبوابتك الصحيحة تلقائياً — سواء كنت عميلاً أو مورداً أو من فريق الإدارة.
          </p>
        </div>
        <p className="text-xs text-emerald-100/60">© {new Date().getFullYear()} إيبيكس سورس</p>
      </div>

      <div className="flex flex-1 flex-col justify-center px-4 py-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-6 text-center lg:hidden">
            <Logo className="justify-center text-xl text-emerald-800" />
          </div>

          {state?.status === 'choose' ? (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">هذا الحساب مسجَّل بأكثر من صفة — اختر أين تريد الدخول</h2>
              <div className="flex flex-col gap-3">
                {state.options.map((option) => {
                  const Icon = PORTAL_ICON[option.role];
                  return (
                    <a
                      key={option.role}
                      href={option.url}
                      className="flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
                    >
                      <Icon className="h-4 w-4" strokeWidth={2} />
                      الدخول كـ{PORTAL_LABEL[option.role]}
                    </a>
                  );
                })}
              </div>
            </div>
          ) : (
            <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-1 flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <LogIn className="h-4.5 w-4.5" strokeWidth={2} />
                </span>
                <h2 className="text-lg font-semibold text-slate-900">تسجيل الدخول</h2>
              </div>
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
      </div>
    </div>
  );
}
