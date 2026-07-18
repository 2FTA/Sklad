const express = require('express');
const pool = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware, adminOnly);

router.get('/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const { type } = req.query;

  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Некорректный ID пользователя' });
  }

  if (type !== 'movement' && type !== 'return') {
    return res.status(400).json({ error: 'Укажите type: movement или return' });
  }

  const quantityColumn = type === 'movement' ? 'ds.movement' : 'ds."return"';

  try {
    const result = await pool.query(
      `SELECT
         gp.name AS product_name,
         gp.weight AS unit,
         gp.price AS price,
         ${quantityColumn} AS quantity
       FROM daily_stocks ds
       JOIN products p ON ds.product_id = p.id
       JOIN global_products gp ON p.global_product_id = gp.id
       WHERE ds.user_id = $1
         AND ds.date = CURRENT_DATE
         AND ${quantityColumn} > 0
       ORDER BY gp.order_index ASC, gp.id ASC`,
      [userId]
    );

    res.json(
      result.rows.map((row) => ({
        productName: row.product_name,
        unit: row.unit,
        price: row.price ?? 0,
        quantity: row.quantity,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
