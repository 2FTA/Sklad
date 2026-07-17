const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware, adminOnly);

const MONTH_KEY_REGEX = /^\d{4}-\d{2}$/;

function monthKeyToDate(monthKey) {
  return `${monthKey}-01`;
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
              to_char(r.month, 'YYYY-MM') AS month, r.created_at AS "createdAt"
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

router.get('/:userId/:month', async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const month = req.params.month;

  if (!userId || !MONTH_KEY_REGEX.test(month)) {
    return res.status(400).json({ error: 'Некорректные параметры' });
  }

  const monthDate = monthKeyToDate(month);

  try {
    const reportResult = await pool.query(
      `SELECT id, user_id AS "userId", month, created_at AS "createdAt"
       FROM reports
       WHERE user_id = $1 AND month = $2::date`,
      [userId, monthDate]
    );

    if (reportResult.rows.length === 0) {
      return res.json({ exists: false });
    }

    const report = {
      ...reportResult.rows[0],
      month,
    };

    const productsResult = await pool.query(
      `SELECT id, product_name AS name, order_index AS "orderIndex", weight
       FROM report_products
       WHERE report_id = $1
       ORDER BY order_index ASC, id ASC`,
      [report.id]
    );

    const stocksResult = await pool.query(
      `SELECT rp.id AS "productId", rs.date::text AS date, rs.quantity, rs.shipments
       FROM report_stocks rs
       JOIN report_products rp ON rp.id = rs.product_id
       WHERE rs.report_id = $1
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

    await pool.query(
      'DELETE FROM report_stocks WHERE report_id = $1 AND product_id = $2',
      [reportId, productId]
    );
    await pool.query('DELETE FROM report_products WHERE id = $1', [productId]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
