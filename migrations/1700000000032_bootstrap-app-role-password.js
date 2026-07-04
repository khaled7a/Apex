/* eslint-disable @typescript-eslint/no-var-requires */
// Up Migration
//
// app_role (created LOGIN with no password in 1700000000001_extensions-and-roles.sql)
// needs a real password before the running app can connect as it instead of the
// migration-privileged owner role. In local/dev this was always a one-time manual
// `ALTER ROLE app_role WITH PASSWORD '...'` run by hand against a DB the developer
// already had a terminal open to. On a host like Render's free tier there is no
// shell/one-off-job access at all, so this has to be scriptable through the normal
// migration run instead — this file reads the password from an env var (never
// committed to git) and applies it every run. Re-applying the same password on
// every deploy is a no-op in practice, so this is safe to leave in the migration
// chain permanently rather than needing to be removed after first use.
exports.up = (pgm) => {
  const password = process.env.APP_ROLE_PASSWORD;
  if (!password) {
    throw new Error('APP_ROLE_PASSWORD env var is required to set app_role\'s login password');
  }
  pgm.sql(`ALTER ROLE app_role WITH PASSWORD '${password.replace(/'/g, "''")}'`);
};

exports.down = () => {};
