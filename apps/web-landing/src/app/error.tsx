'use client';

/** Root error boundary — same minimal backstop pattern as the 3 portals. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold text-slate-800">حدث خطأ غير متوقع</h1>
      <p className="text-sm text-slate-600">يرجى إعادة المحاولة.</p>
      <button
        onClick={reset}
        className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
