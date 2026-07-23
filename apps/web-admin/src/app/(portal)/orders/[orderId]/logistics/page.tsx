import { Truck, FileUp, FileText, CheckCircle2, MapPin } from 'lucide-react';
import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { addDocument, advanceToDocs, completeLogisticsSetup, finalizeDocsUploaded, markArrived } from '@/actions/shipping';

export default async function LogisticsPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader icon={Truck} title="اللوجستيات والشحن" />

      {order.current_state === 'LOGISTICS_ONLY_SETUP' && (
        <SectionCard icon={Truck} title="إكمال إعداد الشحن">
          <ActionForm action={completeLogisticsSetup} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="إكمال" />
        </SectionCard>
      )}

      {order.current_state === 'LOADING_SHIPPING' && (
        <SectionCard icon={Truck} title="المتابعة لمرحلة المستندات">
          <ActionForm action={advanceToDocs} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="متابعة" />
        </SectionCard>
      )}

      {order.current_state === 'SHIPPING_DOCS' && (
        <div className="space-y-4">
          <SectionCard icon={FileUp} title="رفع مستند شحن">
            <ActionForm action={addDocument} hidden={{ orderId }} submitLabel="رفع">
              <input name="docType" placeholder="نوع المستند (فاتورة، بوليصة شحن...)" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input name="file" type="file" required className="w-full text-sm" />
            </ActionForm>
          </SectionCard>
          {detail.shippingDocuments.length > 0 && (
            <SectionCard icon={FileText} title="المستندات المرفوعة">
              <ul className="space-y-1 text-sm">
                {detail.shippingDocuments.map((doc) => (
                  <li key={doc.id}>{doc.doc_type} — <a href={doc.file_url} className="text-emerald-700 hover:underline" target="_blank" rel="noreferrer">عرض</a></li>
                ))}
              </ul>
            </SectionCard>
          )}
          <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-emerald-900">
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-700" strokeWidth={2} />
              تأكيد اكتمال المستندات
            </h2>
            <ActionForm action={finalizeDocsUploaded} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="تأكيد" />
          </div>
        </div>
      )}

      {order.current_state === 'IN_TRANSIT' && (
        <SectionCard icon={MapPin} title="تأكيد الوصول للميناء">
          <ActionForm action={markArrived} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="تأكيد الوصول" />
        </SectionCard>
      )}

      {!['LOGISTICS_ONLY_SETUP', 'LOADING_SHIPPING', 'SHIPPING_DOCS', 'IN_TRANSIT'].includes(order.current_state) && (
        <EmptyState icon={Truck} message="لا يوجد إجراء لوجستي متاح في هذه المرحلة." />
      )}
    </div>
  );
}
