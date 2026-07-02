export interface AppConfig {
  port: number;
  appDatabaseUrl: string;
  jwt: {
    customerSecret: string;
    supplierSecret: string;
    adminSecret: string;
  };
  /** Bidding window length in ms — defaults to the real 72h, override for staging/tests via BIDDING_DEADLINE_MS. */
  biddingDeadlineMs: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? 3000),
    // The API always connects as app_role — never as the migration/owner
    // role — so that RLS and the audit_log REVOKE actually apply to it.
    appDatabaseUrl: requireEnv('APP_DATABASE_URL'),
    jwt: {
      customerSecret: requireEnv('JWT_CUSTOMER_SECRET'),
      supplierSecret: requireEnv('JWT_SUPPLIER_SECRET'),
      adminSecret: requireEnv('JWT_ADMIN_SECRET'),
    },
    biddingDeadlineMs: Number(process.env.BIDDING_DEADLINE_MS ?? 72 * 60 * 60 * 1000),
  };
}
