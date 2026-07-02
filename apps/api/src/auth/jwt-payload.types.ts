export interface CustomerJwtPayload {
  sub: string;
  aud: 'customer';
}

export interface SupplierJwtPayload {
  sub: string;
  aud: 'supplier';
}

export type AdminJwtRole = 'OWNER' | 'OPERATOR' | 'ACCOUNTANT';

export interface AdminJwtPayload {
  sub: string;
  aud: 'admin';
  role: AdminJwtRole;
}
