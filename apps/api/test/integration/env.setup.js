// Runs before ts-jest loads any application module — points the app at the
// dedicated apex_test database (migrated in the same way apex_dev is) so
// integration tests never touch dev data, and sets a short bidding window
// so tests don't wait 72 real hours for the pg-boss timer to fire.
process.env.APP_DATABASE_URL = 'postgres://app_role:app_role_dev_password@127.0.0.1:5432/apex_test';
process.env.JWT_CUSTOMER_SECRET = 'test-customer-secret';
process.env.JWT_SUPPLIER_SECRET = 'test-supplier-secret';
process.env.JWT_ADMIN_SECRET = 'test-admin-secret';
process.env.BIDDING_DEADLINE_MS = '3000';
process.env.PORT = '0';
