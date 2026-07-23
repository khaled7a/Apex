import Link from 'next/link';
import {
  Building2,
  Truck,
  Package,
  FileCheck2,
  Gavel,
  Factory,
  ShipWheel,
  ShieldCheck,
  Lock,
  Users,
  ArrowLeft,
} from 'lucide-react';
import { Logo } from '@/components/Logo';

const ROLES = [
  {
    icon: Package,
    title: 'عميل',
    description: 'ارفع طلب استيراد، تابع المزايدة، اعتمد التصنيع، وتابع الشحن حتى التسليم.',
  },
  {
    icon: Truck,
    title: 'مورد',
    description: 'تصفّح الطلبات المفتوحة للمزايدة، قدّم عروضك، وأدر إنتاجك وشحناتك.',
  },
  {
    icon: Building2,
    title: 'إدارة',
    description: 'راجع الطلبات، تحقّق من الدفعات، وأدر النزاعات والحسابات.',
  },
];

const STEPS = [
  { icon: FileCheck2, title: 'تقديم الطلب', description: 'العميل يرفع تفاصيل الطلب ويدفع العربون' },
  { icon: Gavel, title: 'مزايدة مغلقة', description: 'موردون موثوقون يقدّمون عروضهم دون رؤية بعضهم' },
  { icon: Factory, title: 'تصنيع وتحقق', description: 'اعتماد التصميم والفحص النهائي بنقطتي تحقق' },
  { icon: ShipWheel, title: 'شحن وتسليم', description: 'تخليص جمركي وتتبّع حتى التسليم النهائي' },
];

const FEATURES = [
  { icon: Lock, label: 'مزايدة مغلقة آمنة' },
  { icon: ShieldCheck, label: 'تحقق مالي مزدوج على كل دفعة' },
  { icon: Users, label: 'كشف هوية تدريجي للمورد' },
  { icon: Building2, label: '3 بوابات متخصصة لكل طرف' },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-emerald-700">
              تسجيل الدخول
            </Link>
            <Link href="/register" className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
              إنشاء حساب
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-800 to-teal-900 text-white">
        <div className="pointer-events-none absolute -end-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -start-24 bottom-0 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">إيبيكس سورس</h1>
          <p className="mx-auto mb-10 max-w-xl text-emerald-50/90">
            منصة استيراد بالوكالة تربط العملاء بموردين موثوقين — من تقديم الطلب والمزايدة المغلقة، مروراً بالتصنيع والشحن، وحتى
            التسليم النهائي — بشفافية وتحقق مالي مزدوج في كل خطوة.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-50"
            >
              تسجيل الدخول
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link
              href="/register"
              className="rounded-md border border-white/40 px-6 py-2.5 text-sm font-medium text-white hover:bg-white/10"
            >
              إنشاء حساب عميل جديد
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-14">
        <h2 className="mb-8 text-center text-xl font-bold text-slate-900">بوابة مخصَّصة لكل طرف</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {ROLES.map((role) => (
            <div key={role.title} className="rounded-xl border border-slate-200 bg-white p-6 text-right shadow-sm transition hover:shadow-md">
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <role.icon className="h-5.5 w-5.5" strokeWidth={2} />
              </span>
              <h3 className="mb-1.5 font-semibold text-slate-900">{role.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{role.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="mb-10 text-center text-xl font-bold text-slate-900">كيف تعمل المنصة</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <div key={step.title} className="relative rounded-xl border border-slate-200 bg-white p-5 text-right shadow-sm">
                <span className="absolute -top-3 -end-3 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white shadow">
                  {index + 1}
                </span>
                <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <step.icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <h3 className="mb-1 text-sm font-semibold text-slate-900">{step.title}</h3>
                <p className="text-xs leading-relaxed text-slate-500">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div key={feature.label} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <feature.icon className="h-4.5 w-4.5" strokeWidth={2} />
              </span>
              <span className="text-sm font-medium text-slate-700">{feature.label}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 text-center sm:flex-row sm:text-right">
          <Logo className="text-base text-slate-700" />
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} إيبيكس سورس — جميع الحقوق محفوظة</p>
        </div>
      </footer>
    </div>
  );
}
