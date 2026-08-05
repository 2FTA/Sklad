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

async function addInventoryLotQuantity(client, productId, shopId, quantity) {
  const amount = parseInt(quantity, 10);

  if (!amount || amount <= 0) {
    return null;
  }

  const { globalProductId, shelfLife } = await resolveGlobalProduct(
    client,
    productId,
    shopId
  );

  const result = await client.query(
    `INSERT INTO inventory_lots (product_id, shop_id, quantity, received_date, expiration_date)
     VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + ($4::int * INTERVAL '1 day'))
     ON CONFLICT (product_id, shop_id, received_date)
     DO UPDATE SET
       quantity = inventory_lots.quantity + EXCLUDED.quantity,
       expiration_date = EXCLUDED.expiration_date,
       updated_at = NOW()
     RETURNING id, quantity, expiration_date::text AS "expirationDate"`,
    [globalProductId, shopId, amount, shelfLife]
  );

  return result.rows[0];
}

async function syncShipmentInventoryLot(
  client,
  productId,
  shopId,
  date,
  shipments,
  oldShipments = 0
) {
  if (date !== todayISO()) {
    return null;
  }

  const newShipments = parseInt(shipments, 10) || 0;
  const previousShipments = parseInt(oldShipments, 10) || 0;
  const shipmentDelta = newShipments - previousShipments;
  const { globalProductId, shelfLife } = await resolveGlobalProduct(
    client,
    productId,
    shopId
  );

  if (newShipments === 0) {
    await client.query(
      `DELETE FROM inventory_lots
       WHERE product_id = $1 AND shop_id = $2 AND received_date = CURRENT_DATE`,
      [globalProductId, shopId]
    );
    return null;
  }

  if (shipmentDelta > 0) {
    const result = await client.query(
      `INSERT INTO inventory_lots (product_id, shop_id, quantity, received_date, expiration_date)
       VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + ($4::int * INTERVAL '1 day'))
       ON CONFLICT (product_id, shop_id, received_date)
       DO UPDATE SET
         quantity = inventory_lots.quantity + EXCLUDED.quantity,
         expiration_date = EXCLUDED.expiration_date,
         updated_at = NOW()
       RETURNING id, quantity, expiration_date::text AS "expirationDate"`,
      [globalProductId, shopId, shipmentDelta, shelfLife]
    );

    return result.rows[0];
  }

  if (shipmentDelta < 0) {
    await consumeInventory(client, productId, shopId, -shipmentDelta);
  } else {
    await client.query(
      `UPDATE inventory_lots
       SET expiration_date = CURRENT_DATE + ($3::int * INTERVAL '1 day'),
           updated_at = NOW()
       WHERE product_id = $1 AND shop_id = $2 AND received_date = CURRENT_DATE`,
      [globalProductId, shopId, shelfLife]
    );
  }

  const current = await client.query(
    `SELECT id, quantity, expiration_date::text AS "expirationDate"
     FROM inventory_lots
     WHERE product_id = $1 AND shop_id = $2 AND received_date = CURRENT_DATE`,
    [globalProductId, shopId]
  );

  return current.rows[0] || null;
}

async function receiveInventory(client, productId, shopId, quantity) {
  return addInventoryLotQuantity(client, productId, shopId, quantity);
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
    return 0;
  }

  const quantity = result.rows[0].quantity;
  return quantity === null || quantity === undefined ? 0 : quantity;
}

async function processQuantityDiff(client, productId, shopId, date, currentQuantity) {
  const previousQuantity = await getPreviousDayQuantity(client, productId, shopId, date);
  const diff = previousQuantity - currentQuantity;

  if (diff > 0) {
    await consumeInventory(client, productId, shopId, diff);
  } else if (diff < 0) {
    await addInventoryLotQuantity(client, productId, shopId, -diff);
  }
}

async function processAdminStockInventory(client, productId, shopId, date, before, item) {
  const oldShipments = before?.shipments ?? 0;
  const oldMovement = before?.movement ?? 0;
  const oldReturn = before?.return ?? 0;

  const newShipments = parseInt(item.shipments, 10) || 0;
  const newMovement = parseInt(item.movement, 10) || 0;
  const newReturn = parseInt(item.return, 10) || 0;

  if (date === todayISO()) {
    await syncShipmentInventoryLot(
      client,
      productId,
      shopId,
      date,
      newShipments,
      oldShipments
    );
  }

  const movementDelta = newMovement - oldMovement;
  const returnDelta = newReturn - oldReturn;

  if (movementDelta > 0) {
    await consumeInventory(client, productId, shopId, movementDelta);
  }

  if (returnDelta > 0) {
    await consumeInventory(client, productId, shopId, returnDelta);
  }
}

async function processQuantityInventory(client, productId, shopId, date, quantity) {
  if (date !== todayISO()) {
    return;
  }

  await processQuantityDiff(client, productId, shopId, date, quantity);
}

module.exports = {
  receiveInventory,
  consumeInventory,
  syncShipmentInventoryLot,
  addInventoryLotQuantity,
  getExistingDailyStock,
  getPreviousDayQuantity,
  processAdminStockInventory,
  processQuantityInventory,
  processQuantityDiff,
};
