const pool = require('../db');

const FIFO_KEY = 'fifo_enabled';

async function isFifoEnabled(db = pool) {
  try {
    const result = await db.query('SELECT value FROM app_settings WHERE key = $1', [FIFO_KEY]);

    if (result.rows.length === 0) {
      return true;
    }

    const value = String(result.rows[0].value ?? '').trim().toLowerCase();
    return value !== 'false' && value !== '0';
  } catch (err) {
    console.error(err);
    return true;
  }
}

async function setFifoEnabled(enabled, db = pool) {
  const value = enabled ? 'true' : 'false';

  await db.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           updated_at = NOW()`,
    [FIFO_KEY, value]
  );

  return enabled;
}

module.exports = {
  FIFO_KEY,
  isFifoEnabled,
  setFifoEnabled,
};
