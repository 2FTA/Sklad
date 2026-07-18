const express = require('express');
const pool = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { syncDailyStockToReport } = require('../utils/reportSync');

const router = express.Router();

router.use(authMiddleware);

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return formatDate(d);
}

function defaultDateRange() {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 14);
  return { startDate: formatDate(start), endDate: formatDate(end) };
}

router.post('/', async (req, res) => {
  const targetUserId = req.body.userId
    ? parseInt(req.body.userId, 10)
    : req.user.id;
  const date = req.body.date || todayISO();
  const { stocks } = req.body;

  if (!Array.isArray(stocks) || stocks.length === 0) {
    return res.status(400).json({ error: 'Укажите список остатков' });
  }

  if (req.user.role !== 'admin' && req.user.id !== targetUserId) {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }

  try {
    const user = await pool.query('SELECT id FROM users WHERE id = $1', [targetUserId]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const saved = [];

    for (const item of stocks) {
      const productId = parseInt(item.productId, 10);

      if (isNaN(productId)) {
        return res.status(400).json({ error: 'Некорректные данные остатков' });
      }

      const product = await pool.query(
        'SELECT id FROM products WHERE id = $1 AND user_id = $2',
        [productId, targetUserId]
      );

      if (product.rows.length === 0) {
        return res.status(404).json({ error: `Товар ${productId} не найден` });
      }

      const hasQuantity =
        item.quantity !== undefined &&
        item.quantity !== null &&
        item.quantity !== '';

      if (hasQuantity) {
        const quantity = parseInt(item.quantity, 10);

        if (isNaN(quantity) || quantity < 0) {
          return res.status(400).json({ error: 'Некорректные данные остатков' });
        }

        const result = await pool.query(
          `INSERT INTO daily_stocks (product_id, user_id, date, quantity, shipments, movement, "return")
           VALUES ($1, $2, $3::date, $4, 0, 0, 0)
           ON CONFLICT (product_id, date)
           DO UPDATE SET quantity = $4
           RETURNING product_id AS "productId", date::text AS date, quantity, shipments,
                     movement, "return" AS "return"`,
          [productId, targetUserId, date, quantity]
        );

        await pool.query(
          'UPDATE products SET quantity = $1 WHERE id = $2',
          [quantity, productId]
        );

        saved.push(result.rows[0]);
      } else if (req.user.role === 'admin') {
        const shipments = parseInt(item.shipments, 10) || 0;
        const movement = parseInt(item.movement, 10) || 0;
        const returnValue = parseInt(item.return, 10) || 0;

        const result = await pool.query(
          `INSERT INTO daily_stocks (product_id, user_id, date, quantity, shipments, movement, "return")
           VALUES ($1, $2, $3::date, NULL, $4, $5, $6)
           ON CONFLICT (product_id, date)
           DO UPDATE SET shipments = $4, movement = $5, "return" = $6
           RETURNING product_id AS "productId", date::text AS date, quantity, shipments,
                     movement, "return" AS "return"`,
          [productId, targetUserId, date, shipments, movement, returnValue]
        );

        saved.push(result.rows[0]);
      } else {
        return res.status(400).json({ error: 'Некорректные данные остатков' });
      }

      const savedRow = saved[saved.length - 1];

      try {
        await syncDailyStockToReport(
          pool,
          targetUserId,
          date,
          productId,
          savedRow.quantity,
          savedRow.shipments
        );
      } catch (syncErr) {
        console.error('Ошибка синхронизации отчета:', syncErr);
      }
    }

    res.json({ success: true, date, saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/today', adminOnly, async (req, res) => {
  const date = req.query.date || todayISO();

  try {
    const result = await pool.query(
      `SELECT p.user_id AS "userId", gp.id AS "globalProductId",
              COALESCE(ds.shipments, 0)::int AS shipments
       FROM products p
       JOIN global_products gp ON p.global_product_id = gp.id
       JOIN users u ON u.id = p.user_id AND u.role = 'user'
       LEFT JOIN daily_stocks ds ON ds.product_id = p.id AND ds.date = $1::date
       ORDER BY gp.order_index ASC, u.login ASC`,
      [date]
    );

    res.json({ date, shipments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const defaults = defaultDateRange();
  const startDate = req.query.startDate || defaults.startDate;
  const endDate = req.query.endDate || defaults.endDate;
  const totalDate = req.query.totalDate || todayISO();

  if (req.user.role !== 'admin' && req.user.id !== userId) {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }

  try {
    const user = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const result = await pool.query(
      `SELECT p.id AS "productId", gp.name AS "productName", gp.weight,
              ds.date::text AS date, ds.quantity, ds.shipments,
              ds.movement, ds."return" AS "return"
       FROM products p
       JOIN global_products gp ON p.global_product_id = gp.id
       LEFT JOIN daily_stocks ds ON ds.product_id = p.id
         AND ds.date >= $2::date AND ds.date <= $3::date
       WHERE p.user_id = $1
       ORDER BY gp.order_index ASC, ds.date DESC`,
      [userId, startDate, endDate]
    );

    const stocks = result.rows
      .filter((row) => row.date !== null)
      .map((row) => ({
        productId: row.productId,
        productName: row.productName,
        weight: row.weight,
        date: row.date,
        quantity: row.quantity,
        shipments: row.shipments ?? 0,
        movement: row.movement ?? 0,
        return: row.return ?? 0,
      }));

    let storeTotal = 0;

    if (req.user.role === 'admin') {
      const totalResult = await pool.query(
        `SELECT COALESCE(SUM(COALESCE(ds.quantity, 0) + COALESCE(ds.shipments, 0)), 0)::int AS store_total
         FROM products p
         JOIN global_products gp ON p.global_product_id = gp.id
         LEFT JOIN daily_stocks ds ON ds.product_id = p.id AND ds.date = $2::date
         WHERE p.user_id = $1 AND gp.weight = '1л'`,
        [userId, totalDate]
      );
      storeTotal = totalResult.rows[0].store_total;
    }

    res.json({ stocks, storeTotal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:userId/shipment', async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const { productId, date, shipments } = req.body;

  if (!productId || !date) {
    return res.status(400).json({ error: 'Укажите товар и дату' });
  }

  if (shipments === undefined || shipments === null || isNaN(parseInt(shipments, 10))) {
    return res.status(400).json({ error: 'Укажите корректное количество отгрузок' });
  }

  if (req.user.role !== 'admin' && req.user.id !== userId) {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }

  try {
    const product = await pool.query(
      'SELECT id, user_id FROM products WHERE id = $1 AND user_id = $2',
      [parseInt(productId, 10), userId]
    );

    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const shipmentValue = parseInt(shipments, 10);

    const result = await pool.query(
      `INSERT INTO daily_stocks (product_id, user_id, date, quantity, shipments, movement, "return")
       VALUES ($1, $2, $3::date, NULL, $4, COALESCE($5, 0), COALESCE($6, 0))
       ON CONFLICT (product_id, date)
       DO UPDATE SET shipments = $4,
                     movement = COALESCE($5, daily_stocks.movement),
                     "return" = COALESCE($6, daily_stocks."return")
       RETURNING product_id AS "productId", date::text AS date, quantity, shipments,
                 movement, "return" AS "return"`,
      [
        parseInt(productId, 10),
        userId,
        date,
        shipmentValue,
        req.body.movement !== undefined ? parseInt(req.body.movement, 10) || 0 : null,
        req.body.return !== undefined ? parseInt(req.body.return, 10) || 0 : null,
      ]
    );

    const row = result.rows[0];
    const productInfo = await pool.query('SELECT name FROM products WHERE id = $1', [productId]);

    try {
      await syncDailyStockToReport(
        pool,
        userId,
        date,
        parseInt(productId, 10),
        row.quantity,
        row.shipments
      );
    } catch (syncErr) {
      console.error('Ошибка синхронизации отчета:', syncErr);
    }

    res.json({
      productId: row.productId,
      productName: productInfo.rows[0].name,
      date: row.date,
      quantity: row.quantity,
      shipments: row.shipments,
      movement: row.movement ?? 0,
      return: row.return ?? 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
