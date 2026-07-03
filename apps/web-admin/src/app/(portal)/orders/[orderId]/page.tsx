import Link from 'next/link';
import { getAuditLog, getOrderDetail } from '@/lib/orders';
import { OrderStateBadge } from '@/components/OrderStateBadge';
import { OrderTimeline } from '@/components/OrderTimeline';
import { getAdminAction, orderStateLabel } from '@/lib/state-labels';

function money(value: string | null): string {
  if (!value) return '—';
  return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(Number(value));
}

export default async function OrderHubPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const [detail, auditLog] = await Promise.all([getOrderDetail(orderId), getAuditLog(orderId)]);
  const { order } = detail;

  const action = getAdminAction(order.id, order.current_state, order.hold_type);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-slate-400">#{order.id}</p>
          <h1 className="text-xl font-bold">تفاصيل الطلب</h1>
        </div>
        <OrderStateBadge state={order.current_state} holdType={order.hold_type} />
      </div>

      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="mb-3 font-semibold text-emerald-900">ماذا الآن؟</h2>
        {action.waiting ? (
          <p className="text-sm text-emerald-800">{action.label}</p>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-emerald-800">{action.label}</p>
            <Link href={action.href} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
              متابعة
            </Link>
          </div>
        )}
      </section>

      {order.hold_type === 'NONE' && (
        <p className="text-sm text-slate-600">
          هل يوجد نزاع على هذا الطلب؟{' '}
          <Link href={`/orders/${order.id}/dispute/new`} className="font-medium text-emerald-700 hover:underline">
            افتح نزاعاً
          </Link>
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">العميل</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">الاسم</dt><dd>{detail.customer.name}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">الشركة</dt><dd>{detail.customer.company_name ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">البريد</dt><dd>{detail.customer.email}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">الهاتف</dt><dd>{detail.customer.phone}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">السجل التجاري</dt><dd>{detail.customer.cr_number ?? '—'}</dd></div>
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">المورد</h2>
          {detail.registeredSupplier ? (
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">الاسم (مسجَّل)</dt><dd>{detail.registeredSupplier.legal_name}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">بريد التواصل</dt><dd>{detail.registeredSupplier.contact_email ?? '—'}</dd></div>
            </dl>
          ) : detail.externalSupplier ? (
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">الاسم (خارجي)</dt><dd>{detail.externalSupplier.legal_name}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">حالة الفحص</dt><dd>{detail.externalSupplier.vetting_status}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-slate-500">لم يُختر مورد بعد.</p>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">القيمة المالية</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">قيمة FOB (USD)</dt><dd>{order.fob_value_usd ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">سعر الصرف</dt><dd>{order.fx_rate_used ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">القيمة النهائية</dt><dd>{money(order.final_value_sar)}</dd></div>
            {order.fx_rate_deviation_flag && (
              <div className="flex justify-between text-amber-700"><dt>انحراف سعر الصرف</dt><dd>{order.fx_rate_deviation_approved_at ? 'معتمَد' : 'بانتظار اعتماد OWNER'}</dd></div>
            )}
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">خطة الدفع</h2>
          {detail.installments.length === 0 ? (
            <p className="text-sm text-slate-500">لم تُنشأ خطة دفع بعد.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {detail.installments.map((inst) => (
                <li key={inst.id} className="flex justify-between">
                  <span>{inst.label}</span>
                  <span>{money(inst.expected_amount_sar)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {detail.customsFees.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">رسوم التخليص</h2>
          <ul className="space-y-1 text-sm">
            {detail.customsFees.map((fee) => (
              <li key={fee.id} className="flex justify-between">
                <span>{fee.label}</span>
                <span>{money(fee.amount_sar)} — {fee.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(detail.disputes.length > 0 || detail.escalations.length > 0 || detail.renewals.length > 0) && (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">النزاعات والتصعيدات والتجديدات</h2>
          <ul className="space-y-1 text-sm">
            {detail.disputes.map((d) => (
              <li key={d.id}>نزاع {d.type} — {d.status}</li>
            ))}
            {detail.escalations.map((e) => (
              <li key={e.id}>تصعيد ({e.actor}) — {e.resolved_at ? 'مُغلَق' : 'مفتوح'}</li>
            ))}
            {detail.renewals.map((r) => (
              <li key={r.id}>تجديد — المورد: {r.supplier_decision}، الإدارة: {r.admin_decision}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">سجل الطلب</h2>
        <OrderTimeline entries={detail.timeline} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">سجل التدقيق (Audit Log)</h2>
        {auditLog.length === 0 ? (
          <p className="text-sm text-slate-500">لا يوجد سجل بعد.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {auditLog.map((entry) => (
              <li key={entry.id} className="border-b border-slate-100 pb-2">
                <span className="font-medium">{entry.action}</span> — {entry.actor_role}
                {' · '}
                {new Date(entry.occurred_at).toLocaleString('ar-SA')}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-400">{orderStateLabel(order.current_state)}</p>
    </div>
  );
}
