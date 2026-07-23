import { Lock } from 'lucide-react';
import { ActionForm } from '@/components/ActionForm';
import { Logo } from '@/components/Logo';
import { resetPassword } from '@/actions/password-reset';

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="mb-6">
        <Logo className="text-xl text-emerald-800" suffix="الإدارة" />
      </div>
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <Lock className="h-4.5 w-4.5" strokeWidth={2} />
          </span>
          إعادة تعيين كلمة المرور
        </h1>
        {!token ? (
          <p className="text-sm text-red-700">الرابط غير صالح — تأكد من استخدام نفس الرابط المُرسَل إلى بريدك.</p>
        ) : (
          <ActionForm action={resetPassword} hidden={{ token }} submitLabel="تعيين كلمة المرور الجديدة">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">كلمة المرور الجديدة</label>
              <input name="newPassword" type="password" required minLength={8} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </ActionForm>
        )}
      </div>
    </div>
  );
}
