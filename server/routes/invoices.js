const express = require('express');
const pool = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { generateInvoiceExcelBuffer, buildInvoiceFileName } = require('../utils/invoiceExcel');
const { parseInvoicePayload } = require('../utils/invoicePayload');

const router = express.Router();

const VALID_TYPES = ['movement', 'return', 'shipment'];
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

router.use(authMiddleware, adminOnly);

function getMonthRange(monthValue) {
  if (!monthValue || !MONTH_PATTERN.test(monthValue)) {
    return null;
  }

  const startDate = `${monthValue}-01`;
  const [year, month] = monthValue.split('-').map(Number);
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  return { startDate, endDate };
}

router.get('/', async (req, res) => {
  const shopId = req.query.shopId ? parseInt(req.query.shopId, 10) : null;
  const type = req.query.type;
  const monthRange = getMonthRange(req.query.month);

  if (!shopId || isNaN(shopId)) {
    return res.status(400).json({ error: 'Укажите магазин' });
  }

  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Укажите тип движения' });
  }

  if (!monthRange) {
    return res.status(400).json({ error: 'Укажите месяц в формате YYYY-MM' });
  }

  try {
    const result = await pool.query(
      `SELECT i.id,
              i.date::text AS date,
              i.type,
              i.total_sum AS "totalSum",
              u.login AS "shopName",
              u2.login AS "fromShopName"
       FROM invoices i
       LEFT JOIN users u ON i.shop_id = u.id
       LEFT JOIN users u2 ON i.from_shop_id = u2.id
       WHERE i.shop_id = $1
         AND i.type = $2
         AND i.date BETWEEN $3::date AND $4::date
       ORDER BY i.date DESC, i.id DESC`,
      [shopId, type, monthRange.startDate, monthRange.endDate]
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
              items,
              total_sum AS "totalSum",
              from_shop_id AS "fromShopId"
       FROM invoices
       WHERE id = $1`,
      [id]
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Накладная не найдена' });
    }

    const row = invoiceResult.rows[0];
    const payload = parseInvoicePayload(row.items);

    if (payload.items.length === 0) {
      return res.status(404).json({ error: 'Позиции накладной не найдены' });
    }

    const invoice = {
      type: row.type,
      date: row.date,
      fromName: payload.fromName,
      toName: payload.toName,
      totalSum: row.totalSum,
    };

    const buffer = await generateInvoiceExcelBuffer(invoice, payload.items);
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
