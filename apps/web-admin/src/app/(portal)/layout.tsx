import Link from 'next/link';
import { logout } from '@/actions/auth';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-lg font-bold text-emerald-800">
            إيبيكس سورس — الإدارة
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-slate-600 hover:text-emerald-700">
              لوحة التحكم
            </Link>
            <Link href="/accounts" className="text-sm text-slate-600 hover:text-emerald-700">
              الحسابات
            </Link>
            <form action={logout}>
              <button type="submit" className="text-sm text-slate-600 hover:text-red-700">
                خروج
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
