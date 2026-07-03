import { ActionForm } from '@/components/ActionForm';
import { resetPassword } from '@/actions/password-reset';

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-center text-2xl font-bold text-emerald-800">إيبيكس سورس — بوابة المورد</h1>
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">إعادة تعيين كلمة المرور</h2>
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
