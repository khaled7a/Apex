import { Boxes } from 'lucide-react';

export function Logo({ className, suffix }: { className?: string; suffix?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold ${className ?? 'text-lg text-emerald-800'}`}>
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-white">
        <Boxes className="h-4.5 w-4.5" strokeWidth={2.25} />
      </span>
      إيبيكس سورس{suffix ? ` — ${suffix}` : ''}
    </span>
  );
}
