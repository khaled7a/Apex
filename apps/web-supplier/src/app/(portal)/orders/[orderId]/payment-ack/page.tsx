import { Wallet } from 'lucide-react';
import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { acknowledgePayment } from '@/actions/payments';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';

export default async function PaymentAckPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader icon={Wallet} title="تأكيد استلام الدفعة" />
      {order.current_state === 'PAYMENT_PENDING_SUPPLIER_ACK' ? (
        <Card>
          <p className="mb-3 text-sm text-slate-600">
            بتأكيدك أنت تُقرّ باستلام الدفعة فعلياً — سيتحقق الفريق الإداري من هذا التأكيد قبل اعتماده نهائياً.
          </p>
          <ActionForm action={acknowledgePayment} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="أؤكد استلام الدفعة" />
        </Card>
      ) : (
        <EmptyState icon={Wallet} message="لا يوجد تأكيد دفعة مطلوب في هذه المرحلة." />
      )}
    </div>
  );
}
