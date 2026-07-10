import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearAuth, getStoredUser } from '../api';
import AdminTopBar from '../components/AdminTopBar';
import './Dashboard.css';

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

  const handleUpdateQuantity = async (productId) => {
    try {
      await api.updateQuantity(productId, qtyInputs[productId]);
      flash('Количество обновлено');
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
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
                </div>
              ))}
            </div>
          </aside>
        </>
      )}

      <main className={`main-content ${isAdmin ? 'with-sidebar' : ''}`}>
        {isAdmin ? (
          <AdminTopBar
            title={`Склад пользователя: ${displayName}`}
            onMenuClick={() => setSidebarOpen(true)}
          />
        ) : (
          <div className="top-bar">
            <h1>Мой склад</h1>
            <div className="top-bar-actions">
              <span className="user-badge">{currentUser?.login}</span>
              <button className="btn-logout" onClick={handleLogout}>
                Выйти
              </button>
            </div>
          </div>
        )}

        <div className="content-area">
          {error && (
            <div className="error-banner" onClick={() => setError('')}>
              {error}
            </div>
          )}
          {success && <div className="success-banner">{success}</div>}

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
                    <th>Обновить количество</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td className="quantity-cell">{p.quantity}</td>
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
    </div>
  );
}

export default Dashboard;
