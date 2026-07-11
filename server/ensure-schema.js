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

module.exports = { ensureDailyStocksSchema };
