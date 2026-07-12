const express = require('express');
const pool = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware, adminOnly);

async function renumberAll(client) {
  await client.query(`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY order_index ASC, id ASC) AS new_order
      FROM global_products
    )
    UPDATE global_products gp
    SET order_index = r.new_order
    FROM ranked r
    WHERE gp.id = r.id
  `);
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT gp.id, gp.name, gp.order_index,
             COALESCE(SUM(p.quantity), 0)::int AS total_quantity
      FROM global_products gp
      LEFT JOIN products p ON p.global_product_id = gp.id
      GROUP BY gp.id
      ORDER BY gp.order_index ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', async (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Укажите название товара' });
  }

  const trimmedName = name.trim();

  try {
    const existing = await pool.query(
      'SELECT id FROM global_products WHERE LOWER(name) = LOWER($1)',
      [trimmedName]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Товар с таким названием уже существует' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const maxResult = await client.query(
        'SELECT COALESCE(MAX(order_index), 0) AS max_order FROM global_products'
      );
      const orderIndex = maxResult.rows[0].max_order + 1;

      const created = await client.query(
        'INSERT INTO global_products (name, order_index) VALUES ($1, $2) RETURNING id, name, order_index',
        [trimmedName, orderIndex]
      );

      const globalProduct = created.rows[0];

      await client.query(
        `INSERT INTO products (user_id, global_product_id, name, quantity)
         SELECT u.id, $1, $2, 0 FROM users u WHERE u.role = 'user'`,
        [globalProduct.id, trimmedName]
      );

      await client.query('COMMIT');

      res.status(201).json(globalProduct);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id/order', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { orderIndex } = req.body;

  if (orderIndex === undefined || orderIndex === null || isNaN(parseInt(orderIndex, 10))) {
    return res.status(400).json({ error: 'Укажите корректный порядок' });
  }

  const newOrder = parseInt(orderIndex, 10);
  if (newOrder < 1) {
    return res.status(400).json({ error: 'Порядок должен быть больше 0' });
  }

  try {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const product = await client.query('SELECT id FROM global_products WHERE id = $1', [id]);

      if (product.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Товар не найден' });
      }

      await client.query(
        'UPDATE global_products SET order_index = $1 WHERE id = $2',
        [newOrder, id]
      );

      await renumberAll(client);

      const result = await client.query(
        'SELECT id, name, order_index FROM global_products WHERE id = $1',
        [id]
      );

      await client.query('COMMIT');

      res.json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Укажите название' });
  }

  const trimmedName = name.trim();

  try {
    const duplicate = await pool.query(
      'SELECT id FROM global_products WHERE LOWER(name) = LOWER($1) AND id != $2',
      [trimmedName, id]
    );

    if (duplicate.rows.length > 0) {
      return res.status(400).json({ error: 'Товар с таким названием уже существует' });
    }

    const result = await pool.query(
      'UPDATE global_products SET name = $1 WHERE id = $2 RETURNING id, name, order_index',
      [trimmedName, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    await pool.query(
      'UPDATE products SET name = $1 WHERE global_product_id = $2',
      [trimmedName, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        'DELETE FROM global_products WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Товар не найден' });
      }

      await renumberAll(client);

      await client.query('COMMIT');

      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
