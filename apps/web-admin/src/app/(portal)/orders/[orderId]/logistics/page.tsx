import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { addDocument, advanceToDocs, completeLogisticsSetup, finalizeDocsUploaded, markArrived } from '@/actions/shipping';

export default async function LogisticsPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-bold">اللوجستيات والشحن</h1>

      {order.current_state === 'LOGISTICS_ONLY_SETUP' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">إكمال إعداد الشحن</h2>
          <ActionForm action={completeLogisticsSetup} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="إكمال" />
        </div>
      )}

      {order.current_state === 'LOADING_SHIPPING' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">المتابعة لمرحلة المستندات</h2>
          <ActionForm action={advanceToDocs} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="متابعة" />
        </div>
      )}

      {order.current_state === 'SHIPPING_DOCS' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 font-semibold">رفع مستند شحن</h2>
            <ActionForm action={addDocument} hidden={{ orderId }} submitLabel="رفع">
              <input name="docType" placeholder="نوع المستند (فاتورة، بوليصة شحن...)" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input name="file" type="file" required className="w-full text-sm" />
            </ActionForm>
          </div>
          {detail.shippingDocuments.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-3 font-semibold">المستندات المرفوعة</h2>
              <ul className="space-y-1 text-sm">
                {detail.shippingDocuments.map((doc) => (
                  <li key={doc.id}>{doc.doc_type} — <a href={doc.file_url} className="text-emerald-700 hover:underline" target="_blank" rel="noreferrer">عرض</a></li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-lg border border-emerald-200 bg-white p-5">
            <h2 className="mb-3 font-semibold">تأكيد اكتمال المستندات</h2>
            <ActionForm action={finalizeDocsUploaded} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="تأكيد" />
          </div>
        </div>
      )}

      {order.current_state === 'IN_TRANSIT' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">تأكيد الوصول للميناء</h2>
          <ActionForm action={markArrived} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="تأكيد الوصول" />
        </div>
      )}

      {!['LOGISTICS_ONLY_SETUP', 'LOADING_SHIPPING', 'SHIPPING_DOCS', 'IN_TRANSIT'].includes(order.current_state) && (
        <p className="text-sm text-slate-500">لا يوجد إجراء لوجستي متاح في هذه المرحلة.</p>
      )}
    </div>
  );
}
