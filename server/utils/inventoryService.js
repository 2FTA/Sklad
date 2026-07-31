function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function resolveGlobalProduct(client, productId, shopId) {
  const productResult = await client.query(
    `SELECT global_product_id
     FROM products
     WHERE id = $1 AND user_id = $2`,
    [productId, shopId]
  );

  if (productResult.rows.length === 0) {
    throw new Error('Товар не найден для этого магазина');
  }

  const globalProductId = productResult.rows[0].global_product_id;

  if (!globalProductId) {
    throw new Error('Товар не найден в глобальном списке');
  }

  const globalResult = await client.query(
    `SELECT id, shelf_life
     FROM global_products
     WHERE id = $1`,
    [globalProductId]
  );

  if (globalResult.rows.length === 0) {
    throw new Error('Товар не найден в глобальном списке');
  }

  return {
    globalProductId,
    shelfLife: parseInt(globalResult.rows[0].shelf_life ?? 0, 10) || 0,
  };
}

async function syncShipmentInventoryLot(client, productId, shopId, date, shipments) {
  if (date !== todayISO()) {
    return null;
  }

  const amount = parseInt(shipments, 10) || 0;
  const { globalProductId, shelfLife } = await resolveGlobalProduct(
    client,
    productId,
    shopId
  );

  if (amount > 0) {
    const result = await client.query(
      `INSERT INTO inventory_lots (product_id, shop_id, quantity, received_date, expiration_date)
       VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + ($4::int * INTERVAL '1 day'))
       ON CONFLICT (product_id, shop_id, received_date)
       DO UPDATE SET
         quantity = EXCLUDED.quantity,
         expiration_date = EXCLUDED.expiration_date,
         updated_at = NOW()
       RETURNING id, quantity, expiration_date::text AS "expirationDate"`,
      [globalProductId, shopId, amount, shelfLife]
    );

    return result.rows[0];
  }

  await client.query(
    `DELETE FROM inventory_lots
     WHERE product_id = $1 AND shop_id = $2 AND received_date = CURRENT_DATE`,
    [globalProductId, shopId]
  );

  return null;
}

async function receiveInventory(client, productId, shopId, quantity) {
  return syncShipmentInventoryLot(client, productId, shopId, todayISO(), quantity);
}

async function consumeInventory(client, productId, shopId, quantity) {
  const amount = parseInt(quantity, 10);

  if (!amount || amount <= 0) {
    return;
  }

  const { globalProductId } = await resolveGlobalProduct(client, productId, shopId);

  await client.query('CALL consume_inventory_fifo($1, $2, $3)', [
    globalProductId,
    shopId,
    amount,
  ]);
}

async function getExistingDailyStock(client, productId, shopId, date) {
  const result = await client.query(
    `SELECT quantity, shipments, movement, "return" AS "return"
     FROM daily_stocks
     WHERE product_id = $1 AND user_id = $2 AND date = $3::date`,
    [productId, shopId, date]
  );

  return result.rows[0] || null;
}

async function getPreviousDayQuantity(client, productId, shopId, date) {
  const result = await client.query(
    `SELECT quantity
     FROM daily_stocks
     WHERE product_id = $1 AND user_id = $2 AND date = ($3::date - INTERVAL '1 day')::date`,
    [productId, shopId, date]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].quantity;
}

async function processAdminStockInventory(
  client,
  productId,
  shopId,
  date,
  before,
  item,
  savedRow
) {
  const oldMovement = before?.movement ?? 0;
  const oldReturn = before?.return ?? 0;

  const newShipments = parseInt(item.shipments, 10) || 0;
  const newMovement = parseInt(item.movement, 10) || 0;
  const newReturn = parseInt(item.return, 10) || 0;

  if (date === todayISO()) {
    await syncShipmentInventoryLot(client, productId, shopId, date, newShipments);
  }

  let consumeQty = 0;
  const previousDayQuantity = await getPreviousDayQuantity(client, productId, shopId, date);
  const currentQuantity = savedRow.quantity;

  if (
    previousDayQuantity !== null &&
    previousDayQuantity !== undefined &&
    currentQuantity !== null &&
    currentQuantity !== undefined &&
    previousDayQuantity > currentQuantity
  ) {
    consumeQty += previousDayQuantity - currentQuantity;
  }

  const movementDelta = newMovement - oldMovement;
  const returnDelta = newReturn - oldReturn;

  if (movementDelta > 0) {
    consumeQty += movementDelta;
  }

  if (returnDelta > 0) {
    consumeQty += returnDelta;
  }

  if (consumeQty > 0) {
    await consumeInventory(client, productId, shopId, consumeQty);
  }
}

async function processQuantityInventory(client, productId, shopId, date, quantity) {
  const previousDayQuantity = await getPreviousDayQuantity(client, productId, shopId, date);

  if (
    previousDayQuantity !== null &&
    previousDayQuantity !== undefined &&
    previousDayQuantity > quantity
  ) {
    await consumeInventory(client, productId, shopId, previousDayQuantity - quantity);
  }
}

module.exports = {
  receiveInventory,
  consumeInventory,
  syncShipmentInventoryLot,
  getExistingDailyStock,
  getPreviousDayQuantity,
  processAdminStockInventory,
  processQuantityInventory,
};
