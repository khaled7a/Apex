'use client';

import { useActionState } from 'react';
import type { ActionState } from '@/lib/action-helpers';
import { FormError } from './FormError';
import { SubmitButton } from './SubmitButton';

/**
 * The common shape behind almost every mutation in this app: a few hidden
 * fields (orderId, expectedStateVersion, ...), an optional visible input or
 * two, a submit button, and an inline error if the transition is rejected
 * (stale state_version, invalid for the current state, etc.).
 */
export function ActionForm({
  action,
  hidden,
  children,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  hidden?: Record<string, string | number>;
  children?: React.ReactNode;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3">
      {hidden &&
        Object.entries(hidden).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      {children}
      <FormError message={state?.error} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
