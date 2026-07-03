import Link from 'next/link';
import { getOrderDetail } from '@/lib/orders';
import { OrderStateBadge } from '@/components/OrderStateBadge';
import { OrderTimeline } from '@/components/OrderTimeline';
import { ActionForm } from '@/components/ActionForm';
import { submitOrder, resubmitOrder } from '@/actions/orders';
import { customerResponds } from '@/actions/escalation';
import { getCustomerAction } from '@/lib/state-labels';

export default async function OrderHubPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;

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
        <StatusAction orderId={order.id} state={order.current_state} holdType={order.hold_type} stateVersion={order.state_version} />
      </section>

      {order.hold_type === 'NONE' && (
        <p className="text-sm text-slate-600">
          تواجه مشكلة في هذا الطلب؟{' '}
          <Link href={`/orders/${order.id}/dispute/new`} className="font-medium text-emerald-700 hover:underline">
            افتح نزاعاً
          </Link>
        </p>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">سجل الطلب</h2>
        <OrderTimeline entries={detail.timeline} />
      </section>
    </div>
  );
}

function StatusAction({ orderId, state, holdType, stateVersion }: { orderId: string; state: string; holdType: string; stateVersion: number }) {
  if (state === 'DRAFT') {
    return (
      <ActionForm action={submitOrder} hidden={{ orderId, expectedStateVersion: stateVersion }} submitLabel="قدّم الطلب الآن">
        <p className="text-sm text-emerald-800">طلبك محفوظ كمسودة — اضغط للتقديم إلى الإدارة للمراجعة.</p>
      </ActionForm>
    );
  }
  if (state === 'REVIEW_NEEDS_EDIT') {
    return (
      <ActionForm action={resubmitOrder} hidden={{ orderId, expectedStateVersion: stateVersion }} submitLabel="أعد التقديم">
        <p className="text-sm text-emerald-800">طلبت الإدارة تعديل الطلب — بعد المراجعة أعد تقديمه.</p>
      </ActionForm>
    );
  }
  if (holdType === 'ESCALATION' && state === 'ESCALATION_REMINDER') {
    return (
      <ActionForm action={customerResponds} hidden={{ orderId, expectedStateVersion: stateVersion }} submitLabel="أؤكد أنني بانتظار التنفيذ">
        <p className="text-sm text-emerald-800">لم يصلنا ردّك على هذه المرحلة — يرجى التأكيد قبل انتهاء المهلة لتجنّب التصعيد.</p>
      </ActionForm>
    );
  }

  const action = getCustomerAction(orderId, state, holdType);
  if (action.waiting) {
    return <p className="text-sm text-emerald-800">{action.label}</p>;
  }
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-emerald-800">{action.label}</p>
      <Link href={action.href} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
        متابعة
      </Link>
    </div>
  );
}
