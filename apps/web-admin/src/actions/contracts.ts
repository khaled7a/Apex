'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { describeApiError, formString, type ActionState } from '@/lib/action-helpers';

/**
 * Fixed at two installments (deposit + balance) — a simple, common shape for
 * v1's manual per-order plan authoring. docs/state-machine.md §3 requires
 * plans be manual/per-order (no fixed template), which this keeps true for
 * the amounts/labels while keeping the form itself tractable.
 */
export async function createPaymentPlan(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = formString(formData, 'orderId');
  try {
    await apiFetch(`/contracts/${orderId}/payment-plan`, {
      method: 'POST',
      body: {
        installments: [
          {
            label: formString(formData, 'installment1Label') || 'الدفعة الأولى',
            expectedAmountSar: Number(formData.get('installment1Amount')),
            isTrustFund: true,
            refundPolicy: 'REFUNDABLE_UNTIL_EVENT',
          },
          {
            label: formString(formData, 'installment2Label') || 'الدفعة الثانية',
            expectedAmountSar: Number(formData.get('installment2Amount')),
            isTrustFund: true,
            refundPolicy: 'REFUNDABLE_UNTIL_EVENT',
          },
        ],
      },
    });
  } catch (err) {
    return describeApiError(err, 'تعذّر إنشاء خطة الدفع');
  }
  revalidatePath(`/orders/${orderId}`);
}
