const express = require('express');
const pool = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { PRODUCT_CATEGORY_BEER } = require('../utils/productCategory');

const router = express.Router();

router.use(authMiddleware, adminOnly);

router.get('/:date', async (req, res) => {
  const { date } = req.params;

  try {
    const result = await pool.query(
      `SELECT ss.product_id AS "productId", ss.warehouse, ss.warehouse_motornaya AS "warehouseMotornaya"
       FROM summary_stocks ss
       JOIN global_products gp ON gp.id = ss.product_id
       WHERE ss.date = $1::date AND gp.category = $2`,
      [date, PRODUCT_CATEGORY_BEER]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', async (req, res) => {
  const { date, items } = req.body;

  if (!date || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Укажите дату и данные для сохранения' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const item of items) {
      const productId = parseInt(item.productId, 10);
      if (isNaN(productId)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Некорректный идентификатор товара' });
      }

      const product = await client.query(
        'SELECT id FROM global_products WHERE id = $1 AND category = $2',
        [productId, PRODUCT_CATEGORY_BEER]
      );

      if (product.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Товар ${productId} не найден` });
      }

      const warehouse =
        item.warehouse === null || item.warehouse === undefined || item.warehouse === ''
          ? null
          : parseInt(item.warehouse, 10);
      const warehouseMotornaya =
        item.warehouseMotornaya === null ||
        item.warehouseMotornaya === undefined ||
        item.warehouseMotornaya === ''
          ? null
          : parseInt(item.warehouseMotornaya, 10);

      if (
        (warehouse !== null && isNaN(warehouse)) ||
        (warehouseMotornaya !== null && isNaN(warehouseMotornaya))
      ) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Некорректные значения склада' });
      }

      await client.query(
        `INSERT INTO summary_stocks (product_id, date, warehouse, warehouse_motornaya)
         VALUES ($1, $2::date, $3, $4)
         ON CONFLICT (product_id, date)
         DO UPDATE SET
           warehouse = EXCLUDED.warehouse,
           warehouse_motornaya = EXCLUDED.warehouse_motornaya`,
        [productId, date, warehouse, warehouseMotornaya]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

module.exports = router;
