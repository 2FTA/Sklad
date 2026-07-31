async function getProductShelfLife(client, productId, shopId) {
  const result = await client.query(
    `SELECT gp.shelf_life
     FROM products p
     JOIN global_products gp ON p.global_product_id = gp.id
     WHERE p.id = $1 AND p.user_id = $2`,
    [productId, shopId]
  );

  if (result.rows.length === 0) {
    throw new Error('Товар не найден');
  }

  return parseInt(result.rows[0].shelf_life ?? 0, 10) || 0;
}

async function receiveInventory(client, productId, shopId, quantity) {
  const amount = parseInt(quantity, 10);

  if (!amount || amount <= 0) {
    return null;
  }

  const shelfLife = await getProductShelfLife(client, productId, shopId);

  const result = await client.query(
    `INSERT INTO inventory_lots (product_id, shop_id, quantity, received_date, expiration_date)
     VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + ($4::int * INTERVAL '1 day'))
     RETURNING id, quantity, expiration_date::text AS "expirationDate"`,
    [productId, shopId, amount, shelfLife]
  );

  return result.rows[0];
}

async function consumeInventory(client, productId, shopId, quantity) {
  const amount = parseInt(quantity, 10);

  if (!amount || amount <= 0) {
    return;
  }

  await client.query('CALL consume_inventory_fifo($1, $2, $3)', [
    productId,
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
  const oldShipments = before?.shipments ?? 0;
  const oldMovement = before?.movement ?? 0;
  const oldReturn = before?.return ?? 0;

  const newShipments = parseInt(item.shipments, 10) || 0;
  const newMovement = parseInt(item.movement, 10) || 0;
  const newReturn = parseInt(item.return, 10) || 0;

  const shipmentDelta = newShipments - oldShipments;
  if (shipmentDelta > 0) {
    await receiveInventory(client, productId, shopId, shipmentDelta);
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
  getExistingDailyStock,
  getPreviousDayQuantity,
  processAdminStockInventory,
  processQuantityInventory,
};
