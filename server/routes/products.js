const express = require('express');
const pool = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    let userId = req.user.id;

    if (req.user.role === 'admin' && req.query.userId) {
      userId = parseInt(req.query.userId, 10);
    }

    const result = await pool.query(
      'SELECT id, name, quantity FROM products WHERE user_id = $1 ORDER BY name',
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', adminOnly, async (req, res) => {
  const { name, userId, quantity = 0 } = req.body;

  if (!name || !userId) {
    return res.status(400).json({ error: 'Укажите название и пользователя' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO products (user_id, name, quantity) VALUES ($1, $2, $3) RETURNING id, name, quantity',
      [parseInt(userId, 10), name.trim(), parseInt(quantity, 10) || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id/quantity', async (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const { quantity } = req.body;

  if (quantity === undefined || quantity === null || isNaN(parseInt(quantity, 10))) {
    return res.status(400).json({ error: 'Укажите корректное количество' });
  }

  try {
    const product = await pool.query(
      'SELECT id, user_id FROM products WHERE id = $1',
      [productId]
    );

    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    if (req.user.role !== 'admin' && product.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const result = await pool.query(
      'UPDATE products SET quantity = $1 WHERE id = $2 RETURNING id, name, quantity',
      [parseInt(quantity, 10), productId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/:id/name', adminOnly, async (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Укажите название' });
  }

  try {
    const result = await pool.query(
      'UPDATE products SET name = $1 WHERE id = $2 RETURNING id, name, quantity',
      [name.trim(), productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', adminOnly, async (req, res) => {
  const productId = parseInt(req.params.id, 10);

  try {
    const result = await pool.query(
      'DELETE FROM products WHERE id = $1 RETURNING id',
      [productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
