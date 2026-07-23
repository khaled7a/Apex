export type PortalRole = 'CUSTOMER' | 'SUPPLIER' | 'ADMIN';

/** Base URL of each portal this app hands a session off to via /sso — see src/actions/auth.ts. */
export const PORTAL_URL: Record<PortalRole, string> = {
  CUSTOMER: process.env.CUSTOMER_PORTAL_URL ?? 'http://localhost:3001',
  SUPPLIER: process.env.SUPPLIER_PORTAL_URL ?? 'http://localhost:3002',
  ADMIN: process.env.ADMIN_PORTAL_URL ?? 'http://localhost:3003',
};

export const PORTAL_LABEL: Record<PortalRole, string> = {
  CUSTOMER: 'عميل',
  SUPPLIER: 'مورد',
  ADMIN: 'إدارة',
};

export function ssoUrl(role: PortalRole, code: string): string {
  return `${PORTAL_URL[role]}/sso?code=${encodeURIComponent(code)}`;
}
