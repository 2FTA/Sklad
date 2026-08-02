const express = require('express');
const pool = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const {
  receiveInventory,
  consumeInventory,
} = require('../utils/inventoryService');

const router = express.Router();

const VALID_INVOICE_TYPES = ['movement', 'return', 'shipment'];

router.use(authMiddleware, adminOnly);

router.post('/invoice', async (req, res) => {
  const shopId = parseInt(req.body.shopId, 10);
  const type = req.body.type;
  const items = req.body.items;
  const fromShopId =
    req.body.fromShopId !== undefined && req.body.fromShopId !== null
      ? parseInt(req.body.fromShopId, 10)
      : null;
  const fromName = req.body.fromName?.trim();
  const toName = req.body.toName?.trim();

  if (isNaN(shopId)) {
    return res.status(400).json({ error: 'Укажите корректный магазин' });
  }

  if (!VALID_INVOICE_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Укажите type: movement, return или shipment' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Укажите позиции накладной' });
  }

  if (!fromName || !toName) {
    return res.status(400).json({ error: 'Укажите отправителя и получателя' });
  }

  const normalizedItems = items.map((item, index) => {
    const quantity = parseInt(item.quantity, 10) || 0;
    const price = parseInt(item.price, 10) || 0;
    const sum = item.sum !== undefined ? parseInt(item.sum, 10) || 0 : quantity * price;
    const productId =
      item.productId !== undefined && item.productId !== null
        ? parseInt(item.productId, 10)
        : null;

    return {
      productId: Number.isNaN(productId) ? null : productId,
      productName: item.productName?.trim() || '—',
      unit: item.unit || '—',
      quantity,
      price,
      sum,
      sortOrder: index,
    };
  });

  const totalSum = normalizedItems.reduce((acc, item) => acc + item.sum, 0);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const shop = await client.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'user'`,
      [shopId]
    );

    if (shop.rows.length === 0) {
      throw new Error('Магазин не найден');
    }

    if (fromShopId !== null && !Number.isNaN(fromShopId)) {
      const fromShop = await client.query(
        `SELECT id FROM users WHERE id = $1 AND role = 'user'`,
        [fromShopId]
      );

      if (fromShop.rows.length === 0) {
        throw new Error('Магазин-отправитель не найден');
      }
    }

    const invoiceResult = await client.query(
      `INSERT INTO invoices (shop_id, type, date, from_shop_id, from_name, to_name, total_sum)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6)
       ON CONFLICT (shop_id, type, date)
       DO UPDATE SET
         from_shop_id = EXCLUDED.from_shop_id,
         from_name = EXCLUDED.from_name,
         to_name = EXCLUDED.to_name,
         total_sum = EXCLUDED.total_sum,
         updated_at = NOW()
       RETURNING id,
                 shop_id AS "shopId",
                 type,
                 date::text AS date,
                 from_shop_id AS "fromShopId",
                 from_name AS "fromName",
                 to_name AS "toName",
                 total_sum AS "totalSum",
                 created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      [
        shopId,
        type,
        fromShopId !== null && !Number.isNaN(fromShopId) ? fromShopId : null,
        fromName,
        toName,
        totalSum,
      ]
    );

    const invoiceId = invoiceResult.rows[0].id;

    await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [invoiceId]);

    for (const item of normalizedItems) {
      await client.query(
        `INSERT INTO invoice_items
           (invoice_id, product_id, product_name, unit, quantity, price, line_sum, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          invoiceId,
          item.productId,
          item.productName,
          item.unit,
          item.quantity,
          item.price,
          item.sum,
          item.sortOrder,
        ]
      );
    }

    await client.query('COMMIT');
    res.json(invoiceResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    const message = err.message || 'Ошибка сервера';
    const status = message.includes('не найден') ? 400 : 500;
    res.status(status).json({ error: message });
  } finally {
    client.release();
  }
});

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
    const message = err.message || 'Ошибка сервера';
    const status =
      message.includes('не найден') || /не хват|insufficient|спис/i.test(message)
        ? 400
        : 500;
    res.status(status).json({ error: message });
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
      receivedDate: row.receiveddate || row.received_date || row.receivedDate,
      daysUntilExpiry:
        row.daysuntilexpiry ??
        row.days_until_expiry ??
        row.daysUntilExpiry,
    }));

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
