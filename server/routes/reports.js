const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware, adminOnly);

function getMonthDays(month) {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const daysCount = new Date(year, monthNum, 0).getDate();
  const dates = [];

  for (let day = 1; day <= daysCount; day++) {
    const m = String(monthNum).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    dates.push(`${year}-${m}-${d}`);
  }

  return dates;
}

async function verifyAdminPassword(adminUserId, password) {
  const result = await pool.query(
    'SELECT password_hash FROM users WHERE id = $1 AND role = $2',
    [adminUserId, 'admin']
  );

  if (result.rows.length === 0) {
    return false;
  }

  return bcrypt.compare(password, result.rows[0].password_hash);
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.user_id AS "userId", u.login AS "userLogin",
              r.month, r.created_at AS "createdAt"
       FROM reports r
       JOIN users u ON u.id = r.user_id
       ORDER BY r.month DESC, u.login ASC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/generate', async (req, res) => {
  const userId = parseInt(req.body.userId, 10);
  const month = req.body.month;

  if (!userId || !month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Укажите магазин и месяц' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const user = await client.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'user'",
      [userId]
    );

    if (user.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Магазин не найден' });
    }

    const existing = await client.query(
      'SELECT id FROM reports WHERE user_id = $1 AND month = $2',
      [userId, month]
    );

    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Отчет за этот месяц уже существует' });
    }

    const reportResult = await client.query(
      `INSERT INTO reports (user_id, month)
       VALUES ($1, $2)
       RETURNING id, user_id AS "userId", month, created_at AS "createdAt"`,
      [userId, month]
    );

    const report = reportResult.rows[0];
    const monthDays = getMonthDays(month);

    const globalProducts = await client.query(
      'SELECT id, name, order_index, weight FROM global_products ORDER BY order_index ASC, id ASC'
    );

    const userProducts = await client.query(
      'SELECT id, global_product_id FROM products WHERE user_id = $1',
      [userId]
    );

    const userProductMap = {};
    for (const row of userProducts.rows) {
      userProductMap[row.global_product_id] = row.id;
    }

    for (const gp of globalProducts.rows) {
      const reportProductResult = await client.query(
        `INSERT INTO report_products (report_id, name, order_index, global_product_id, weight)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [report.id, gp.name, gp.order_index, gp.id, gp.weight || '1л']
      );

      const reportProductId = reportProductResult.rows[0].id;
      const sourceProductId = userProductMap[gp.id];

      for (const date of monthDays) {
        let quantity = null;
        let shipments = 0;

        if (sourceProductId) {
          const stockResult = await client.query(
            `SELECT quantity, shipments
             FROM daily_stocks
             WHERE product_id = $1 AND date = $2::date`,
            [sourceProductId, date]
          );

          if (stockResult.rows.length > 0) {
            quantity = stockResult.rows[0].quantity;
            shipments = stockResult.rows[0].shipments ?? 0;
          }
        }

        await client.query(
          `INSERT INTO report_stocks (report_product_id, date, quantity, shipments)
           VALUES ($1, $2::date, $3, $4)`,
          [reportProductId, date, quantity, shipments]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, report });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

router.get('/:userId/:month', async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const month = req.params.month;

  if (!userId || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Некорректные параметры' });
  }

  try {
    const reportResult = await pool.query(
      `SELECT id, user_id AS "userId", month, created_at AS "createdAt"
       FROM reports
       WHERE user_id = $1 AND month = $2`,
      [userId, month]
    );

    if (reportResult.rows.length === 0) {
      return res.json({ exists: false });
    }

    const report = reportResult.rows[0];

    const productsResult = await pool.query(
      `SELECT id, name, order_index AS "orderIndex", global_product_id AS "globalProductId", weight
       FROM report_products
       WHERE report_id = $1
       ORDER BY order_index ASC, id ASC`,
      [report.id]
    );

    const stocksResult = await pool.query(
      `SELECT rp.id AS "productId", rs.date::text AS date, rs.quantity, rs.shipments
       FROM report_stocks rs
       JOIN report_products rp ON rp.id = rs.report_product_id
       WHERE rp.report_id = $1
       ORDER BY rs.date ASC, rp.order_index ASC`,
      [report.id]
    );

    res.json({
      exists: true,
      report,
      products: productsResult.rows,
      stocks: stocksResult.rows.map((row) => ({
        productId: row.productId,
        date: row.date,
        quantity: row.quantity,
        shipments: row.shipments ?? 0,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:reportId/products/:productId', async (req, res) => {
  const reportId = parseInt(req.params.reportId, 10);
  const productId = parseInt(req.params.productId, 10);
  const { password } = req.body;

  if (!reportId || !productId) {
    return res.status(400).json({ error: 'Некорректные параметры' });
  }

  if (!password) {
    return res.status(400).json({ error: 'Введите пароль администратора' });
  }

  try {
    const validPassword = await verifyAdminPassword(req.user.id, password);

    if (!validPassword) {
      return res.status(403).json({ error: 'Неверный пароль администратора' });
    }

    const product = await pool.query(
      `SELECT rp.id
       FROM report_products rp
       WHERE rp.id = $1 AND rp.report_id = $2`,
      [productId, reportId]
    );

    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден в отчете' });
    }

    await pool.query('DELETE FROM report_products WHERE id = $1', [productId]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
