function normalizeStoredItems(rawItems) {
  if (!rawItems) {
    return [];
  }

  const parsed = typeof rawItems === 'string' ? JSON.parse(rawItems) : rawItems;

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (Array.isArray(parsed.items)) {
    return parsed.items;
  }

  return [];
}

function parseInvoicePayload(rawItems) {
  if (!rawItems) {
    return { fromName: '—', toName: '—', items: [] };
  }

  const parsed = typeof rawItems === 'string' ? JSON.parse(rawItems) : rawItems;

  if (Array.isArray(parsed)) {
    return { fromName: '—', toName: '—', items: parsed };
  }

  return {
    fromName: parsed.fromName || '—',
    toName: parsed.toName || '—',
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
}

function buildInvoicePayload(fromName, toName, items) {
  return {
    fromName,
    toName,
    items: items.map((item) => ({
      productId: item.productId ?? null,
      productName: item.productName,
      unit: item.unit,
      quantity: item.quantity,
      price: item.price,
      sum: item.sum,
    })),
  };
}

module.exports = {
  normalizeStoredItems,
  parseInvoicePayload,
  buildInvoicePayload,
};
