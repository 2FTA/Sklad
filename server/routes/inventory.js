const express = require('express');
const pool = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const {
  receiveInventory,
  consumeInventory,
} = require('../utils/inventoryService');

const router = express.Router();

router.use(authMiddleware, adminOnly);

router.post('/receive', async (req, res) => {
  const productId = parseInt(req.body.productId, 10);
  const shopId = parseInt(req.body.shopId, 10);
  const quantity = parseInt(req.body.quantity, 10);

  if (isNaN(productId) || isNaN(shopId) || isNaN(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'Укажите корректные productId, shopId и quantity' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const lot = await receiveInventory(client, productId, shopId, quantity);
    await client.query('COMMIT');
    res.json(lot);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

router.post('/consume', async (req, res) => {
  const productId = parseInt(req.body.productId, 10);
  const shopId = parseInt(req.body.shopId, 10);
  const quantity = parseInt(req.body.quantity, 10);

  if (isNaN(productId) || isNaN(shopId) || isNaN(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'Укажите корректные productId, shopId и quantity' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await consumeInventory(client, productId, shopId, quantity);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(400).json({ error: err.message || 'Не удалось списать товар' });
  } finally {
    client.release();
  }
});

router.get('/expired', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM get_expired_lots()');

    const rows = result.rows.map((row) => ({
      shopName: row.shopname || row.shop_name || row.shopName,
      productName: row.productname || row.product_name || row.productName,
      quantity: row.quantity,
      expirationDate: row.expirationdate || row.expiration_date || row.expirationDate,
      daysOverdue: row.daysoverdue ?? row.days_overdue ?? row.daysOverdue,
    }));

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
