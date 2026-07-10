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

  getProducts: (userId) =>
    request(userId ? `/products?userId=${userId}` : '/products'),

  getAllProducts: () => request('/products/all'),

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