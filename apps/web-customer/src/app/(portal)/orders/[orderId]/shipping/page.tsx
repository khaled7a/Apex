import { Truck, FileText } from 'lucide-react';
import { getOrderDetail } from '@/lib/orders';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

export default async function ShippingPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);

  return (
    <div className="space-y-6">
      <PageHeader icon={Truck} title="الشحن" subtitle="هذه الصفحة للاطّلاع فقط — إجراءات الشحن تُدار من قِبل الإدارة." />

      {detail.shippingDocuments.length === 0 ? (
        <EmptyState icon={FileText} message="لا توجد مستندات شحن بعد." />
      ) : (
        <ul className="space-y-2">
          {detail.shippingDocuments.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="flex items-center gap-1.5 text-sm">
                <FileText className="h-4 w-4 text-slate-400" strokeWidth={2} />
                {doc.doc_type}
              </span>
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
