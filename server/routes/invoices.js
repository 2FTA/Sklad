const express = require('express');
const pool = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { generateInvoiceExcelBuffer, buildInvoiceFileName } = require('../utils/invoiceExcel');

const router = express.Router();

const VALID_TYPES = ['movement', 'return', 'shipment'];
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

router.use(authMiddleware, adminOnly);

function normalizeMonth(value) {
  if (!value || !MONTH_PATTERN.test(value)) {
    return null;
  }

  return `${value}-01`;
}

router.get('/', async (req, res) => {
  const shopId = req.query.shopId ? parseInt(req.query.shopId, 10) : null;
  const type = req.query.type;
  const month = normalizeMonth(req.query.month);

  if (!shopId || isNaN(shopId)) {
    return res.status(400).json({ error: 'Укажите магазин' });
  }

  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Укажите тип движения' });
  }

  if (!month) {
    return res.status(400).json({ error: 'Укажите месяц в формате YYYY-MM' });
  }

  try {
    const result = await pool.query(
      `SELECT id,
              shop_id AS "shopId",
              type,
              date::text AS date,
              from_shop_id AS "fromShopId",
              from_name AS "fromName",
              to_name AS "toName",
              total_sum AS "totalSum",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM invoices
       WHERE shop_id = $1
         AND type = $2
         AND date >= $3::date
         AND date < ($3::date + INTERVAL '1 month')
       ORDER BY date DESC, id DESC`,
      [shopId, type, month]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id/download', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Некорректный идентификатор' });
  }

  try {
    const invoiceResult = await pool.query(
      `SELECT id,
              shop_id AS "shopId",
              type,
              date::text AS date,
              from_name AS "fromName",
              to_name AS "toName",
              total_sum AS "totalSum"
       FROM invoices
       WHERE id = $1`,
      [id]
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Накладная не найдена' });
    }

    const invoice = invoiceResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT product_id AS "productId",
              product_name AS "productName",
              unit,
              quantity,
              price,
              line_sum AS sum
       FROM invoice_items
       WHERE invoice_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [id]
    );

    if (itemsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Позиции накладной не найдены' });
    }

    const buffer = await generateInvoiceExcelBuffer(invoice, itemsResult.rows);
    const fileName = buildInvoiceFileName(invoice.date);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
