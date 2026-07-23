/**
 * Deliberately a single fixed template for every event, per the brief's
 * content policy: notifications carry no sensitive/identifying details,
 * just a prompt to log in — the platform itself is the source of truth for
 * whatever actually changed.
 */
export function buildGenericMessage(orderId: string): string {
  return `تحديث جديد على طلبك رقم #${orderId}، تفضل بالدخول`;
}
