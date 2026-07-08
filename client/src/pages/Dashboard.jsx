import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearAuth, getStoredUser } from '../api';
import './Dashboard.css';

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const isAdmin = currentUser?.role === 'admin';

  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(
    isAdmin ? null : currentUser?.id
  );
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showRename, setShowRename] = useState(null);

  const [newUser, setNewUser] = useState({ login: '', password: '', role: 'user' });
  const [newProductName, setNewProductName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [qtyInputs, setQtyInputs] = useState({});

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const displayName = isAdmin
    ? selectedUser?.login || '—'
    : currentUser?.login;

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const data = await api.getUsers();
      setUsers(data);
      if (!selectedUserId && data.length > 0) {
        setSelectedUserId(data[0].id);
      }
    } catch (err) {
      setError(err.message);
    }
  }, [isAdmin, selectedUserId]);

  const loadProducts = useCallback(async () => {
    const userId = isAdmin ? selectedUserId : currentUser?.id;
    if (!userId) return;

    setLoading(true);
    try {
      const data = await api.getProducts(isAdmin ? userId : null);
      setProducts(data);
      const inputs = {};
      data.forEach((p) => {
        inputs[p.id] = p.quantity;
      });
      setQtyInputs(inputs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, selectedUserId, currentUser?.id]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const handleSelectUser = (id) => {
    setSelectedUserId(id);
    setSidebarOpen(false);
  };

  const handleDeleteUser = async (e, id, login) => {
    e.stopPropagation();
    if (login === 'admin') return;
    if (!confirm(`Удалить пользователя "${login}" и весь его склад?`)) return;

    try {
      await api.deleteUser(id);
      flash('Пользователь удалён');
      await loadUsers();
      if (selectedUserId === id) {
        setSelectedUserId(null);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const created = await api.createUser(newUser.login, newUser.password, newUser.role);
      setShowAddUser(false);
      setNewUser({ login: '', password: '', role: 'user' });
      flash('Пользователь добавлен');
      await loadUsers();
      setSelectedUserId(created.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await api.createProduct(newProductName, selectedUserId);
      setShowAddProduct(false);
      setNewProductName('');
      flash('Товар добавлен');
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateQuantity = async (productId) => {
    try {
      await api.updateQuantity(productId, qtyInputs[productId]);
      flash('Количество обновлено');
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRename = async (e) => {
    e.preventDefault();
    try {
      await api.updateName(showRename.id, renameName);
      setShowRename(null);
      flash('Название изменено');
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteProduct = async (id, name) => {
    if (!confirm(`Удалить товар "${name}"?`)) return;
    try {
      await api.deleteProduct(id);
      flash('Товар удалён');
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
  };

  const openRename = (product) => {
    setRenameName(product.name);
    setShowRename(product);
  };

  return (
    <div className="dashboard">
      {isAdmin && (
        <>
          <div
            className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
            onClick={() => setSidebarOpen(false)}
          />
          <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
              <h2>👥 Пользователи</h2>
            </div>
            <div className="user-list">
              {users.map((u) => (
                <div
                  key={u.id}
                  className={`user-item ${selectedUserId === u.id ? 'active' : ''}`}
                  onClick={() => handleSelectUser(u.id)}
                >
                  <span className="user-item-name">
                    {u.login}
                    <span className="user-item-role">{u.role}</span>
                  </span>
                  {u.login !== 'admin' && (
                    <button
                      className="btn-delete-user"
                      title="Удалить пользователя"
                      onClick={(e) => handleDeleteUser(e, u.id, u.login)}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="sidebar-footer">
              <button className="btn-add-user" onClick={() => setShowAddUser(true)}>
                + Добавить пользователя
              </button>
            </div>
          </aside>
        </>
      )}

      <main className={`main-content ${isAdmin ? 'with-sidebar' : ''}`}>
        <div className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isAdmin && (
              <button
                className="mobile-menu-btn"
                onClick={() => setSidebarOpen(true)}
                aria-label="Меню"
              >
                ☰
              </button>
            )}
            <h1>
              {isAdmin
                ? `Склад пользователя: ${displayName}`
                : `Мой склад`}
            </h1>
          </div>
          <div className="top-bar-actions">
            <span className="user-badge">{currentUser?.login}</span>
            <button className="btn-logout" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        </div>

        <div className="content-area">
          {error && (
            <div className="error-banner" onClick={() => setError('')}>
              {error}
            </div>
          )}
          {success && <div className="success-banner">{success}</div>}

          {isAdmin && selectedUserId && (
            <button className="btn-add-product" onClick={() => setShowAddProduct(true)}>
              + Добавить товар
            </button>
          )}

          {loading ? (
            <div className="loading">Загрузка...</div>
          ) : products.length === 0 ? (
            <div className="empty-state">
              {isAdmin ? 'У этого пользователя пока нет товаров' : 'Список товаров пуст'}
            </div>
          ) : (
            <div className="products-table-wrapper">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Количество</th>
                    {isAdmin && <th>Действия</th>}
                    <th>Обновить количество</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td className="quantity-cell">{p.quantity}</td>
                      {isAdmin && (
                        <td>
                          <div className="actions-cell">
                            <button
                              className="btn-sm btn-rename"
                              onClick={() => openRename(p)}
                            >
                              ✏️ Изменить название
                            </button>
                            <button
                              className="btn-sm btn-delete"
                              onClick={() => handleDeleteProduct(p.id, p.name)}
                            >
                              ✕ Удалить
                            </button>
                          </div>
                        </td>
                      )}
                      <td>
                        <div className="actions-cell">
                          <input
                            type="number"
                            className="qty-input"
                            min="0"
                            value={qtyInputs[p.id] ?? 0}
                            onChange={(e) =>
                              setQtyInputs({ ...qtyInputs, [p.id]: e.target.value })
                            }
                          />
                          <button
                            className="btn-sm btn-update"
                            onClick={() => handleUpdateQuantity(p.id)}
                          >
                            Обновить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showAddUser && (
        <Modal title="Добавить пользователя" onClose={() => setShowAddUser(false)}>
          <form className="modal-form" onSubmit={handleAddUser}>
            <div className="form-group">
              <label>Логин</label>
              <input
                value={newUser.login}
                onChange={(e) => setNewUser({ ...newUser, login: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Пароль</label>
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Роль</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setShowAddUser(false)}>
                Отмена
              </button>
              <button type="submit" className="btn-primary">
                Сохранить
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showAddProduct && (
        <Modal title="Добавить товар" onClose={() => setShowAddProduct(false)}>
          <form className="modal-form" onSubmit={handleAddProduct}>
            <div className="form-group">
              <label>Название товара</label>
              <input
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="Например: футболки"
                required
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setShowAddProduct(false)}>
                Отмена
              </button>
              <button type="submit" className="btn-primary">
                Добавить
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showRename && (
        <Modal title="Изменить название" onClose={() => setShowRename(null)}>
          <form className="modal-form" onSubmit={handleRename}>
            <div className="form-group">
              <label>Новое название</label>
              <input
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                required
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setShowRename(null)}>
                Отмена
              </button>
              <button type="submit" className="btn-primary">
                Сохранить
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Dashboard;
