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
  /**
   * Deliberately NOT requireEnv() — unlike the secrets above, these have no
   * safe value to fabricate for local/test runs, and no real credentials
   * exist in this environment yet. Missing fields make NotificationsService
   * record notification_log rows as SKIPPED_NO_CONFIG instead of crashing
   * app startup; supplying real values later activates real sending with no
   * code changes.
   */
  smtp: {
    host?: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
    fromAddress: string;
  };
  whatsapp: {
    accessToken?: string;
    phoneNumberId?: string;
    apiBaseUrl: string;
  };
  /** Origin allowed to make credentialed browser requests (the customer/supplier/admin web portals) — defaults to the local Next.js dev port. */
  frontendOrigin: string;
  /** Local-disk root for POST /uploads-stored files — see uploads.service.ts. */
  uploadsDir: string;
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
    smtp: {
      host: process.env.SMTP_HOST || undefined,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: (process.env.SMTP_SECURE ?? 'false') === 'true',
      user: process.env.SMTP_USER || undefined,
      password: process.env.SMTP_PASSWORD || undefined,
      fromAddress: process.env.SMTP_FROM_ADDRESS ?? 'no-reply@apex-sourcing.example',
    },
    whatsapp: {
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || undefined,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || undefined,
      apiBaseUrl: process.env.WHATSAPP_API_BASE_URL ?? 'https://graph.facebook.com/v20.0',
    },
    frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3001',
    uploadsDir: process.env.UPLOADS_DIR ?? './uploads',
  };
}
