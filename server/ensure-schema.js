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
    CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_stocks_product_date
    ON daily_stocks (product_id, date)
  `);
}

async function ensureReportsSchema(pool) {
  // Таблицы reports, report_products и report_stocks созданы в Supabase вручную.
  // Не создаём их здесь, чтобы не конфликтовать со схемой production.
  void pool;
}

async function ensureSchema(pool) {
  await ensureUsersSchema(pool);
  await ensureDailyStocksSchema(pool);
  await ensureReportsSchema(pool);
}

module.exports = {
  ensureSchema,
  ensureUsersSchema,
  ensureDailyStocksSchema,
  ensureReportsSchema,
};
