import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import AdminTopBar from '../components/AdminTopBar';
import './Dashboard.css';
import './AdminPages.css';
import './MovementPage.css';

function MovementPage() {
  const [shopUsers, setShopUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [movementType, setMovementType] = useState('');
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');

  const loadShops = useCallback(async () => {
    try {
      const users = await api.getUsers();
      const shops = users.filter((u) => u.role === 'user');
      setShopUsers(shops);

      setFromUserId((prev) =>
        prev && shops.some((u) => String(u.id) === prev) ? prev : ''
      );
      setToUserId((prev) =>
        prev && shops.some((u) => String(u.id) === prev) ? prev : ''
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadShops();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadShops]);

  const allSelected = movementType && fromUserId && toUserId;

  return (
    <div className="page-layout">
      <AdminTopBar title="Движение" />

      <div className="content-area admin-content-area">
        <div className="movement-toolbar">
          <div className="movement-filter">
            <label htmlFor="movement-type">Действие</label>
            <select
              id="movement-type"
              className="movement-select"
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
            >
              <option value="">—</option>
              <option value="movement">Перемещение</option>
              <option value="return">Возврат</option>
            </select>
          </div>

          <div className="movement-filter">
            <label htmlFor="movement-from">От кого</label>
            <select
              id="movement-from"
              className="movement-select"
              value={fromUserId}
              onChange={(e) => setFromUserId(e.target.value)}
              disabled={shopUsers.length === 0}
            >
              <option value="">—</option>
              {shopUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.login}
                </option>
              ))}
            </select>
          </div>

          <div className="movement-filter">
            <label htmlFor="movement-to">Кому</label>
            <select
              id="movement-to"
              className="movement-select"
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              disabled={shopUsers.length === 0}
            >
              <option value="">—</option>
              {shopUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.login}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="error-banner" onClick={() => setError('')}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading">Загрузка...</div>
        ) : !allSelected ? (
          <div className="empty-state">Выберите все параметры</div>
        ) : (
          <div className="movement-table-placeholder">Таблица появится здесь</div>
        )}
      </div>
    </div>
  );
}

export default MovementPage;
