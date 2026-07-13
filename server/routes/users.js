const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware, adminOnly);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, login, role, capacity FROM users ORDER BY login'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id/password', async (req, res) => {
  const userId = parseInt(req.params.id, 10);

  try {
    const result = await pool.query(
      'SELECT login, password_plain FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const { login, password_plain } = result.rows[0];

    if (!password_plain) {
      return res.status(404).json({ error: 'Пароль недоступен для этого пользователя' });
    }

    res.json({ login, password: password_plain });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id/capacity', async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { capacity } = req.body;

  if (capacity === undefined || capacity === null || isNaN(parseInt(capacity, 10))) {
    return res.status(400).json({ error: 'Укажите корректную вместимость' });
  }

  const capacityValue = parseInt(capacity, 10);
  if (capacityValue < 0) {
    return res.status(400).json({ error: 'Вместимость не может быть отрицательной' });
  }

  try {
    const user = await pool.query('SELECT id, role FROM users WHERE id = $1', [userId]);

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.rows[0].role === 'admin') {
      return res.status(403).json({ error: 'Для администратора вместимость не используется' });
    }

    const result = await pool.query(
      'UPDATE users SET capacity = $1 WHERE id = $2 RETURNING id, login, role, capacity',
      [capacityValue, userId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id/password', async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Введите новый пароль' });
  }

  try {
    const user = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, password_plain = $2 WHERE id = $3',
      [hash, password, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', async (req, res) => {
  const { login, password, role } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: 'Введите логин и пароль' });
  }

  const userRole = role === 'admin' ? 'admin' : 'user';

  try {
    const existing = await pool.query('SELECT id FROM users WHERE login = $1', [
      login.trim(),
    ]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Пользователь с таким логином уже существует' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (login, password_hash, password_plain, role, capacity)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, login, role, capacity`,
      [login.trim(), hash, password, userRole, 1000]
    );

    const newUserId = result.rows[0].id;

    await pool.query(
      `INSERT INTO products (user_id, global_product_id, name, quantity)
       SELECT $1, gp.id, gp.name, 0 FROM global_products gp`,
      [newUserId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', async (req, res) => {
  const userId = parseInt(req.params.id, 10);

  try {
    const user = await pool.query('SELECT id, login, role FROM users WHERE id = $1', [
      userId,
    ]);

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.rows[0].role === 'admin' || user.rows[0].login === 'admin') {
      return res.status(403).json({ error: 'Нельзя удалить администратора' });
    }

    await pool.query('DELETE FROM products WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
