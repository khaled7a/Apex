import Link from 'next/link';

const ROLES = [
  { title: 'عميل', description: 'ارفع طلب استيراد، تابع المزايدة، اعتمد التصنيع، وتابع الشحن حتى التسليم.' },
  { title: 'مورد', description: 'تصفّح الطلبات المفتوحة للمزايدة، قدّم عروضك، وأدر إنتاجك وشحناتك.' },
  { title: 'إدارة', description: 'راجع الطلبات، تحقّق من الدفعات، وأدر النزاعات والحسابات.' },
];

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="mb-3 text-3xl font-bold text-emerald-800">إيبيكس سورس</h1>
      <p className="mb-10 max-w-xl text-slate-600">
        منصة استيراد بالوكالة تربط العملاء بموردين موثوقين — من تقديم الطلب والمزايدة المغلقة، مروراً بالتصنيع والشحن، وحتى التسليم النهائي — بشفافية وتحقق مالي مزدوج في كل خطوة.
      </p>

      <div className="mb-10 grid w-full gap-4 sm:grid-cols-3">
        {ROLES.map((role) => (
          <div key={role.title} className="rounded-lg border border-slate-200 bg-white p-5 text-right shadow-sm">
            <h2 className="mb-2 font-semibold text-emerald-800">{role.title}</h2>
            <p className="text-sm text-slate-600">{role.description}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Link href="/login" className="rounded-md bg-emerald-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-800">
          تسجيل الدخول
        </Link>
        <Link href="/register" className="rounded-md border border-emerald-700 px-6 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
          إنشاء حساب عميل جديد
        </Link>
      </div>
    </div>
  );
}
