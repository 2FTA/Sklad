function dateToMonthStart(dateStr) {
  return `${dateStr.slice(0, 7)}-01`;
}

async function ensureReport(db, userId, monthDate) {
  const existing = await db.query(
    'SELECT id FROM reports WHERE user_id = $1 AND month = $2::date',
    [userId, monthDate]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const created = await db.query(
    `INSERT INTO reports (user_id, month)
     VALUES ($1, $2::date)
     RETURNING id`,
    [userId, monthDate]
  );

  return created.rows[0].id;
}

async function ensureReportProduct(db, reportId, userProductId) {
  const productInfo = await db.query(
    `SELECT gp.name, gp.order_index, gp.weight
     FROM products p
     JOIN global_products gp ON p.global_product_id = gp.id
     WHERE p.id = $1`,
    [userProductId]
  );

  if (productInfo.rows.length === 0) {
    return null;
  }

  const { name, order_index: orderIndex, weight } = productInfo.rows[0];

  const existing = await db.query(
    'SELECT id FROM report_products WHERE report_id = $1 AND product_name = $2',
    [reportId, name]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const created = await db.query(
    `INSERT INTO report_products (report_id, product_name, order_index, weight)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [reportId, name, orderIndex, weight || '1л']
  );

  return created.rows[0].id;
}

async function syncDailyStockToReport(db, userId, date, userProductId, quantity, shipments) {
  const user = await db.query('SELECT role FROM users WHERE id = $1', [userId]);

  if (user.rows.length === 0 || user.rows[0].role !== 'user') {
    return;
  }

  const monthDate = dateToMonthStart(date);
  const reportId = await ensureReport(db, userId, monthDate);
  const reportProductId = await ensureReportProduct(db, reportId, userProductId);

  if (!reportProductId) {
    return;
  }

  await db.query(
    `INSERT INTO report_stocks (report_id, product_id, date, quantity, shipments)
     VALUES ($1, $2, $3::date, $4, $5)
     ON CONFLICT (report_id, product_id, date)
     DO UPDATE SET
       quantity = EXCLUDED.quantity,
       shipments = EXCLUDED.shipments`,
    [reportId, reportProductId, date, quantity, shipments ?? 0]
  );
}

module.exports = {
  syncDailyStockToReport,
};
