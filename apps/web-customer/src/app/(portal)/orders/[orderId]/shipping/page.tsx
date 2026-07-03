import { getOrderDetail } from '@/lib/orders';

export default async function ShippingPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">الشحن</h1>
      <p className="text-sm text-slate-600">هذه الصفحة للاطّلاع فقط — إجراءات الشحن تُدار من قِبل الإدارة.</p>

      {detail.shippingDocuments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">لا توجد مستندات شحن بعد.</p>
      ) : (
        <ul className="space-y-2">
          {detail.shippingDocuments.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
              <span className="text-sm">{doc.doc_type}</span>
              <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-sm text-emerald-700 hover:underline">
                عرض المستند
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
