const express = require('express');
const pool = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware, adminOnly);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name FROM custom_positions ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching custom positions:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', async (req, res) => {
  const { name } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Укажите название' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO custom_positions (name) VALUES ($1) RETURNING id, name',
      [name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Позиция с таким названием уже существует' });
    }
    console.error('Error adding custom position:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Некорректный ID' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM custom_positions WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Позиция не найдена' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting custom position:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
