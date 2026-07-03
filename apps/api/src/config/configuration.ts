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
  /** fx_rate_used deviation from fxReferenceRate beyond this fraction (0.05 = 5%) sets fx_rate_deviation_flag and blocks offer selection until an extra OWNER approval — docs/data-model.md §1's documented tripwire, previously undocumented as unimplemented. */
  fxDeviationThresholdPct: number;
  /** How long a party has to respond once escalated (ESCALATION_REMINDER) before auto-progressing to ESCALATION_ESCALATED — defaults to 3 days, override for staging/tests via ESCALATION_TIMEOUT_MS. */
  escalationTimeoutMs: number;
  /** CUSTOMER_SLA/SUPPLIER_SLA window at each production checkpoint — defaults to 5 days, override for staging/tests via PRODUCTION_SLA_MS. */
  productionSlaMs: number;
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
    fxDeviationThresholdPct: Number(process.env.FX_DEVIATION_THRESHOLD_PCT ?? 0.05),
    escalationTimeoutMs: Number(process.env.ESCALATION_TIMEOUT_MS ?? 3 * 24 * 60 * 60 * 1000),
    productionSlaMs: Number(process.env.PRODUCTION_SLA_MS ?? 5 * 24 * 60 * 60 * 1000),
  };
}
