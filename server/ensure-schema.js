async function ensureUsersSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      login VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user'
    )
  `);

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain VARCHAR(255)
  `);

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 1000
  `);
}

async function ensureDailyStocksSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_stocks (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      quantity INTEGER,
      shipments INTEGER NOT NULL DEFAULT 0
    )
  `);

  await pool.query(`
    DELETE FROM daily_stocks a
    USING daily_stocks b
    WHERE a.id > b.id
      AND a.product_id = b.product_id
      AND a.date = b.date
  `);

  await pool.query(`
    ALTER TABLE daily_stocks ADD COLUMN IF NOT EXISTS movement INTEGER NOT NULL DEFAULT 0
  `);

  await pool.query(`
    ALTER TABLE daily_stocks ADD COLUMN IF NOT EXISTS "return" INTEGER NOT NULL DEFAULT 0
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_stocks_product_date
    ON daily_stocks (product_id, date)
  `);
}

async function ensureGlobalProductsSchema(pool) {
  await pool.query(`
    ALTER TABLE global_products ADD COLUMN IF NOT EXISTS price INTEGER NOT NULL DEFAULT 0
  `);

  await pool.query(`
    ALTER TABLE global_products ADD COLUMN IF NOT EXISTS shelf_life INTEGER NOT NULL DEFAULT 0
  `);

  await pool.query(`
    ALTER TABLE global_products ADD COLUMN IF NOT EXISTS warning_period INTEGER NOT NULL DEFAULT 0
  `);
}

async function ensureCustomPositionsSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS custom_positions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL
    )
  `);
}

async function ensureReportStocksSchema(pool) {
  await pool.query(`
    ALTER TABLE report_stocks ADD COLUMN IF NOT EXISTS movement INTEGER NOT NULL DEFAULT 0
  `);

  await pool.query(`
    ALTER TABLE report_stocks ADD COLUMN IF NOT EXISTS "return" INTEGER NOT NULL DEFAULT 0
  `);
}

async function ensureSummaryStocksSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS summary_stocks (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES global_products(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      warehouse INTEGER,
      warehouse_motornaya INTEGER,
      UNIQUE (product_id, date)
    )
  `);
}

async function ensureMovementExportsSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS movement_exports (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(20) NOT NULL,
      month DATE NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, type, month)
    )
  `);
}

async function ensureInvoicesSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      shop_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(20) NOT NULL CHECK (type IN ('movement', 'return', 'shipment')),
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      from_shop_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      from_name VARCHAR(255) NOT NULL,
      to_name VARCHAR(255) NOT NULL,
      total_sum INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (shop_id, type, date)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      product_name VARCHAR(255) NOT NULL,
      unit VARCHAR(20),
      quantity INTEGER NOT NULL DEFAULT 0,
      price INTEGER NOT NULL DEFAULT 0,
      line_sum INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);
}

async function ensureReportsSchema(pool) {
  // Таблицы reports, report_products и report_stocks созданы в Supabase вручную.
  // Не создаём их здесь, чтобы не конфликтовать со схемой production.
  void pool;
}

async function ensureInventoryLotsSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_lots (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES global_products(id) ON DELETE CASCADE,
      shop_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL,
      received_date DATE NOT NULL DEFAULT CURRENT_DATE,
      expiration_date DATE NOT NULL
    )
  `);

  await pool.query(`
    ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_lots_product_shop_date
    ON inventory_lots (product_id, shop_id, received_date)
  `);

  await pool.query(`DROP FUNCTION IF EXISTS get_expired_lots()`);

  await pool.query(`
    CREATE OR REPLACE FUNCTION get_expired_lots()
    RETURNS TABLE (
      shop_name TEXT,
      product_name TEXT,
      quantity INTEGER,
      received_date DATE,
      days_overdue INTEGER
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        u.login::TEXT AS shop_name,
        gp.name::TEXT AS product_name,
        il.quantity,
        il.received_date,
        (CURRENT_DATE - il.expiration_date)::INTEGER AS days_overdue
      FROM inventory_lots il
      JOIN global_products gp ON gp.id = il.product_id
      JOIN users u ON u.id = il.shop_id
      WHERE il.quantity > 0
        AND il.expiration_date < CURRENT_DATE
      ORDER BY il.received_date, u.login, gp.name;
    END;
    $$
  `);
}

async function ensureSchema(pool) {
  await ensureUsersSchema(pool);
  await ensureGlobalProductsSchema(pool);
  await ensureDailyStocksSchema(pool);
  await ensureCustomPositionsSchema(pool);
  await ensureReportStocksSchema(pool);
  await ensureSummaryStocksSchema(pool);
  await ensureMovementExportsSchema(pool);
  await ensureInvoicesSchema(pool);
  await ensureInventoryLotsSchema(pool);
  await ensureReportsSchema(pool);
}

module.exports = {
  ensureSchema,
  ensureUsersSchema,
  ensureGlobalProductsSchema,
  ensureDailyStocksSchema,
  ensureCustomPositionsSchema,
  ensureReportStocksSchema,
  ensureSummaryStocksSchema,
  ensureMovementExportsSchema,
  ensureInvoicesSchema,
  ensureInventoryLotsSchema,
  ensureReportsSchema,
};
