import { ApiError } from './api';

export type ActionState = { error: string } | undefined;

export function describeApiError(err: unknown, fallback = 'تعذّر تنفيذ العملية، حاول مرة أخرى'): ActionState {
  if (err instanceof ApiError) {
    if (err.status === 409) return { error: 'تغيّرت حالة الطلب أثناء ذلك — يرجى تحديث الصفحة ثم إعادة المحاولة' };
    if (err.status === 422) return { error: 'هذا الإجراء غير متاح في الحالة الحالية للطلب' };
    if (err.status === 404) return { error: 'الطلب غير موجود' };
    if (err.status === 400) return { error: err.message || 'بيانات غير صحيحة' };
    if (err.status === 403) return { error: 'لا تملك صلاحية تنفيذ هذا الإجراء' };
  }
  return { error: fallback };
}

export function formInt(formData: FormData, key: string): number {
  return Number(formData.get(key));
}

export function formString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '');
}
