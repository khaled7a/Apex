import { getMe, listAdmins, listSuppliers } from '@/lib/accounts';
import { ActionForm } from '@/components/ActionForm';
import { createAdmin, createSupplier, deactivateAdmin, deactivateSupplier, reactivateAdmin, reactivateSupplier } from '@/actions/accounts';

const ROLE_LABELS_AR: Record<string, string> = { OWNER: 'مالك', OPERATOR: 'مشغّل', ACCOUNTANT: 'محاسب' };

export default async function AccountsPage() {
  const [me, admins, suppliers] = await Promise.all([getMe(), listAdmins(), listSuppliers()]);
  const canManageAdmins = me.role === 'OWNER';
  const canManageSuppliers = me.role === 'OWNER' || me.role === 'OPERATOR';

  return (
    <div className="space-y-10">
      <section>
        <h1 className="mb-4 text-xl font-bold">حسابات الإدارة</h1>
        <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {admins.map((admin) => (
            <div key={admin.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {admin.name} <span className="text-xs text-slate-400">({ROLE_LABELS_AR[admin.role] ?? admin.role})</span>
                </p>
                <p className="text-xs text-slate-500">{admin.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-xs ${admin.is_active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                  {admin.is_active ? 'نشط' : 'معطَّل'}
                </span>
                {canManageAdmins && admin.id !== me.id && (
                  <ActionForm action={admin.is_active ? deactivateAdmin : reactivateAdmin} hidden={{ id: admin.id }} submitLabel={admin.is_active ? 'تعطيل' : 'تفعيل'} />
                )}
              </div>
            </div>
          ))}
        </div>

        {canManageAdmins && (
          <div className="mt-4 max-w-md rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold">إنشاء حساب إدارة جديد</h2>
            <ActionForm action={createAdmin} submitLabel="إنشاء">
              <input name="name" placeholder="الاسم" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input name="email" type="email" placeholder="البريد الإلكتروني" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input name="password" type="password" placeholder="كلمة المرور المبدئية" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <select name="role" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="OPERATOR">مشغّل</option>
                <option value="ACCOUNTANT">محاسب</option>
                <option value="OWNER">مالك</option>
              </select>
            </ActionForm>
          </div>
        )}
      </section>

      <section>
        <h1 className="mb-4 text-xl font-bold">حسابات الموردين</h1>
        <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {suppliers.map((supplier) => (
            <div key={supplier.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{supplier.legal_name}</p>
                <p className="text-xs text-slate-500">{supplier.contact_email ?? '—'}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-xs ${supplier.is_active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                  {supplier.is_active ? 'نشط' : 'معطَّل'}
                </span>
                {canManageSuppliers && (
                  <ActionForm
                    action={supplier.is_active ? deactivateSupplier : reactivateSupplier}
                    hidden={{ id: supplier.id }}
                    submitLabel={supplier.is_active ? 'تعطيل' : 'تفعيل'}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {canManageSuppliers && (
          <div className="mt-4 max-w-md rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold">تسجيل مورد جديد</h2>
            <ActionForm action={createSupplier} submitLabel="تسجيل">
              <input name="legalName" placeholder="الاسم القانوني" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input name="contactEmail" type="email" placeholder="بريد التواصل" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input name="whatsappPhone" placeholder="واتساب (اختياري)" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input name="password" type="password" placeholder="كلمة المرور المبدئية" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </ActionForm>
          </div>
        )}
      </section>
    </div>
  );
}
