import type { LucideIcon } from 'lucide-react';

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className ?? ''}`}>{children}</div>;
}

export function SectionCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className ?? ''}`}>
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
        {Icon && <Icon className="h-4.5 w-4.5 text-emerald-700" strokeWidth={2} />}
        {title}
      </h2>
      {children}
    </section>
  );
}
