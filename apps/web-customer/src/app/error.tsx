'use client';

import Link from 'next/link';

/**
 * Root error boundary — the backstop for cases proxy.ts's proactive session
 * refresh didn't catch (a backend blip right when a page fetched data, clock
 * skew, etc.). Deliberately generic: Next.js strips the original error's
 * details crossing the Server/Client boundary in production, so trying to
 * detect "was this a 401" here would silently fail — a plain retry/login
 * link is the honest, reliable backstop.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold text-slate-800">حدث خطأ غير متوقع</h1>
      <p className="text-sm text-slate-600">يرجى إعادة المحاولة، أو تسجيل الدخول من جديد إن استمرت المشكلة.</p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          إعادة المحاولة
        </button>
        <Link href="/login" className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
          تسجيل الدخول
        </Link>
      </div>
    </div>
  );
}
