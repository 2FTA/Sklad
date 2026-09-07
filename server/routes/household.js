const express = require('express');
const pool = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const {
  PRODUCT_CATEGORY_HOUSEHOLD,
} = require('../utils/productCategory');

const router = express.Router();

router.use(authMiddleware);

router.get('/', adminOnly, async (req, res) => {
  try {
    const usersResult = await pool.query(
      'SELECT id, login FROM users WHERE role = $1 ORDER BY id',
      ['user']
    );

    if (usersResult.rows.length === 0) {
      return res.json([]);
    }

    const requestsResult = await pool.query(
      `SELECT
         hr.id,
         hr.user_id AS "userId",
         u.login AS "shopName",
         gp.name AS "productName",
         hr.quantity,
         hr.request_date AS "requestDate"
       FROM household_requests hr
       JOIN users u ON hr.user_id = u.id
       JOIN global_products gp ON hr.product_id = gp.id
       ORDER BY hr.user_id, hr.request_date DESC`
    );

    const grouped = usersResult.rows.map((user) => ({
      userId: user.id,
      shopName: user.login,
      requests: requestsResult.rows.filter((row) => row.userId === user.id),
    }));

    res.json(grouped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки запросов' });
  }
});

router.post('/', async (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }

  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Нет данных' });
  }

  const client = await pool.connect();
  let inserted = 0;

  try {
    await client.query('BEGIN');

    for (const item of items) {
      const productId = parseInt(item.productId, 10);
      const quantity = parseInt(item.quantity, 10);

      if (isNaN(productId) || isNaN(quantity) || quantity <= 0) {
        continue;
      }

      const product = await client.query(
        `SELECT gp.id
         FROM global_products gp
         JOIN products p ON p.global_product_id = gp.id AND p.user_id = $1
         WHERE gp.id = $2 AND gp.category = $3`,
        [req.user.id, productId, PRODUCT_CATEGORY_HOUSEHOLD]
      );

      if (product.rows.length === 0) {
        throw new Error(`Товар ${productId} не найден`);
      }

      await client.query(
        `INSERT INTO household_requests (user_id, product_id, quantity, request_date)
         VALUES ($1, $2, $3, NOW())`,
        [req.user.id, productId, quantity]
      );
      inserted += 1;
    }

    if (inserted === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Укажите количество хотя бы для одного товара' });
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Данные сохранены' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    const message = err.message || 'Ошибка сохранения';
    const status = /не найден/i.test(message) ? 400 : 500;
    res.status(status).json({ error: message });
  } finally {
    client.release();
  }
});

router.delete('/:id', adminOnly, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Некорректный идентификатор' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM household_requests WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

module.exports = router;
