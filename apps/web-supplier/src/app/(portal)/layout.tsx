import Link from 'next/link';
import { LayoutDashboard, LogOut } from 'lucide-react';
import { logout } from '@/actions/auth';
import { Logo } from '@/components/Logo';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="h-1 bg-gradient-to-l from-emerald-700 via-teal-600 to-emerald-700" />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/dashboard">
            <Logo suffix="المورد" />
          </Link>
          <nav className="flex items-center gap-1.5">
            <Link href="/dashboard" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-emerald-700">
              <LayoutDashboard className="h-4 w-4" strokeWidth={2} />
              لوحتي
            </Link>
            <form action={logout}>
              <button type="submit" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-red-50 hover:text-red-700">
                <LogOut className="h-4 w-4" strokeWidth={2} />
                خروج
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
