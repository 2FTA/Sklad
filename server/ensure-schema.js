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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      month VARCHAR(7) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, month)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS report_products (
      id SERIAL PRIMARY KEY,
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      global_product_id INTEGER,
      weight VARCHAR(10) DEFAULT '1л'
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS report_stocks (
      id SERIAL PRIMARY KEY,
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES report_products(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      quantity INTEGER,
      shipments INTEGER NOT NULL DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_report_stocks_product_date
    ON report_stocks (report_id, product_id, date)
  `);
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
