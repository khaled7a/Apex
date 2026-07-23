'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        'rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60'
      }
    >
      {pending ? 'جارٍ التنفيذ…' : children}
    </button>
  );
}
