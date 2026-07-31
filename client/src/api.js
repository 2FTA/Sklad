// Берем адрес сервера из переменной окружения или используем относительный путь
const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Ошибка запроса');
  }

  return data;
}

async function requestBlob(url) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${url}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Ошибка запроса');
  }

  return res.blob();
}

export const api = {
  login: (login, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    }),

  getMe: () => request('/auth/me'),

  getUsers: () => request('/users'),

  createUser: (login, password, role) =>
    request('/users', {
      method: 'POST',
      body: JSON.stringify({ login, password, role }),
    }),

  deleteUser: (id) =>
    request(`/users/${id}`, { method: 'DELETE' }),

  getUserPassword: (id) => request(`/users/${id}/password`),

  changeUserPassword: (id, password) =>
    request(`/users/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    }),

  updateUserCapacity: (id, capacity) =>
    request(`/users/${id}/capacity`, {
      method: 'PUT',
      body: JSON.stringify({ capacity }),
    }),

  getProducts: (userId) =>
    request(userId ? `/products?userId=${userId}` : '/products'),

  getAllProducts: () => request('/products/all'),

  getAggregatedProducts: () => request('/products/aggregated'),

  getGlobalProducts: () => request('/global-products'),

  createGlobalProduct: (name) =>
    request('/global-products', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  updateGlobalProductOrder: (id, orderIndex) =>
    request(`/global-products/${id}/order`, {
      method: 'PUT',
      body: JSON.stringify({ orderIndex }),
    }),

  updateGlobalProductName: (id, name) =>
    request(`/global-products/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    }),

  updateGlobalProductWeight: (id, weight) =>
    request(`/global-products/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ weight }),
    }),

  updateGlobalProduct: (id, data) =>
    request(`/global-products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteGlobalProduct: (id) =>
    request(`/global-products/${id}`, { method: 'DELETE' }),

  createProductForAllUsers: (name, quantity = 0) =>
    request('/products/all-users', {
      method: 'POST',
      body: JSON.stringify({ name, quantity }),
    }),

  createProduct: (name, userId, quantity = 0) =>
    request('/products', {
      method: 'POST',
      body: JSON.stringify({ name, userId, quantity }),
    }),

  updateQuantity: (id, quantity) =>
    request(`/products/${id}/quantity`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    }),

  updateName: (id, name) =>
    request(`/products/${id}/name`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  deleteProduct: (id) =>
    request(`/products/${id}`, { method: 'DELETE' }),

  getStocks: (userId, startDate, endDate, totalDate) => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (totalDate) params.set('totalDate', totalDate);
    const query = params.toString();
    return request(`/stocks/${userId}${query ? `?${query}` : ''}`);
  },

  updateShipment: (userId, productId, date, shipments) =>
    request(`/stocks/${userId}/shipment`, {
      method: 'PUT',
      body: JSON.stringify({ productId, date, shipments }),
    }),

  saveStocks: (userId, date, stocks) =>
    request('/stocks', {
      method: 'POST',
      body: JSON.stringify({ userId, date, stocks }),
    }),

  updateStockQuantities: (userId, date, items) =>
    request('/stocks/quantity', {
      method: 'PUT',
      body: JSON.stringify({ userId, date, items }),
    }),

  getTodayShipments: (date) => {
    const params = date ? `?date=${date}` : '';
    return request(`/stocks/today${params}`);
  },

  getSummary: (date) => request(`/summary/${date}`),

  saveSummary: (date, items) =>
    request('/summary', {
      method: 'POST',
      body: JSON.stringify({ date, items }),
    }),

  getReports: () => request('/reports'),

  getReport: (userId, month) => request(`/reports/${userId}/${month}`),

  getMovementData: (userId, type) => request(`/movement/${userId}?type=${type}`),

  getExpiredLots: () => request('/inventory/expired'),

  receiveInventory: (productId, shopId, quantity) =>
    request('/inventory/receive', {
      method: 'POST',
      body: JSON.stringify({ productId, shopId, quantity }),
    }),

  consumeInventory: (productId, shopId, quantity) =>
    request('/inventory/consume', {
      method: 'POST',
      body: JSON.stringify({ productId, shopId, quantity }),
    }),

  getMovementExports: (userId, type, month) => {
    const params = new URLSearchParams();
    if (userId) params.set('userId', userId);
    if (type) params.set('type', type);
    if (month) params.set('month', month);
    const query = params.toString();
    return request(`/movement-exports${query ? `?${query}` : ''}`);
  },

  uploadMovementExport: async (userId, type, month, fileBlob, fileName) => {
    const formData = new FormData();
    formData.append('userId', String(userId));
    formData.append('type', type);
    formData.append('month', month);
    formData.append('file', fileBlob, fileName);

    const token = getToken();
    const res = await fetch(`${API_BASE}/movement-exports`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || 'Ошибка загрузки файла');
    }

    return data;
  },

  downloadMovementExport: (id) => requestBlob(`/movement-exports/${id}/download`),

  getCustomPositions: () => request('/custom-positions'),

  createCustomPosition: (name) =>
    request('/custom-positions', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  deleteCustomPosition: (id) =>
    request(`/custom-positions/${id}`, { method: 'DELETE' }),

  deleteReportProduct: (reportId, productId, password) =>
    request(`/reports/${reportId}/products/${productId}`, {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),
};

export function saveAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function getStoredUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}