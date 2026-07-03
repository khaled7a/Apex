/**
 * One-time bootstrap: creates the first ADMIN_OWNER account so someone can
 * actually log in and start using POST /admin/admins to provision the rest.
 * There is no self-registration for admins (security-sensitive), and no
 * endpoint can create the very first one (every admin-provisioning endpoint
 * requires an existing ADMIN_OWNER) — hence a standalone script, run once,
 * outside the HTTP surface. Idempotent: no-ops if any admin_user row already
 * exists, so re-running it (e.g. on every deploy) is safe.
 */
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

async function main() {
  const connectionString = process.env.APP_DATABASE_URL;
  const email = process.env.SEED_ADMIN_EMAIL;
  const name = process.env.SEED_ADMIN_NAME;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!connectionString || !email || !name || !password) {
    console.error('Missing required env vars: APP_DATABASE_URL, SEED_ADMIN_EMAIL, SEED_ADMIN_NAME, SEED_ADMIN_PASSWORD');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  try {
    const { rows } = await pool.query('SELECT id FROM admin_user LIMIT 1');
    if (rows.length > 0) {
      console.log('An admin account already exists — skipping (idempotent no-op).');
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO admin_user (name, email, password_hash, role, mfa_enabled) VALUES ($1, $2, $3, 'OWNER', true)`,
      [name, email, passwordHash],
    );
    console.log(`Created the first ADMIN_OWNER account: ${email}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
