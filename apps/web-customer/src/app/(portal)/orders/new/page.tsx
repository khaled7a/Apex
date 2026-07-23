'use client';

import { useActionState } from 'react';
import { FilePlus2 } from 'lucide-react';
import { createOrder } from '@/actions/orders';
import { FormError } from '@/components/FormError';
import { SubmitButton } from '@/components/SubmitButton';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';

// EXTERNAL_SUPPLIER_SERVICE omitted deliberately — the full external-supplier
// vetting path is not built in apps/api yet (deferred scope), so it isn't
// offered here to avoid leading a customer into a dead end.
const SERVICE_TYPES = [
  { code: 'DOOR_TO_DOOR', label: 'باب لباب' },
  { code: 'SHIPPING_CLEARANCE_ONLY', label: 'شحن وتخليص فقط' },
];

export default function NewOrderPage() {
  const [state, formAction] = useActionState(createOrder, undefined);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader icon={FilePlus2} title="طلب استيراد جديد" />
      <Card>
        <form action={formAction} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">نوع الخدمة</label>
            <div className="space-y-2">
              {SERVICE_TYPES.map((type) => (
                <label key={type.code} className="flex items-center gap-2 rounded-md border border-slate-200 p-3 text-sm hover:bg-slate-50">
                  <input type="radio" name="serviceTypeCode" value={type.code} defaultChecked={type.code === 'DOOR_TO_DOOR'} required />
                  {type.label}
                </label>
              ))}
            </div>
          </div>
          <FormError message={state?.error} />
          <SubmitButton className="w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60">
            إنشاء الطلب
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
