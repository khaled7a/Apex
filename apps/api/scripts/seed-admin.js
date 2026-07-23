/**
 * One-time bootstrap: creates the first ADMIN_OWNER account so someone can
 * actually log in and start using POST /admin/admins to provision the rest.
 * There is no self-registration for admins (security-sensitive), and no
 * endpoint can create the very first one (every admin-provisioning endpoint
 * requires an existing ADMIN_OWNER) — hence a standalone script, run once,
 * outside the HTTP surface. Idempotent: no-ops if any admin_user row already
 * exists, so re-running it (e.g. on every deploy) is safe — deliberately
 * does NOT rotate an existing account's password, since this script's
 * output is chained into the API's own start command and therefore runs on
 * every future deploy: if it kept re-applying SEED_ADMIN_PASSWORD, a real
 * password change made later through the app itself (change-password /
 * forgot-password) would silently get overwritten back to the stale env
 * var value on the next unrelated deploy.
 *
 * Plain CommonJS, not TypeScript: this only ever needs `pg`/`bcrypt`, both
 * real runtime dependencies (not devDependencies like ts-node/typescript),
 * so it runs with a bare `node scripts/seed-admin.js` on any host — no
 * build step or ts-node/register needed, which matters on hosts where the
 * production runtime environment can't be assumed to carry devDependencies.
 */
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

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
