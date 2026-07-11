import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearAuth, getStoredUser } from '../api';
import AdminTopBar from '../components/AdminTopBar';
import {
  getLast15Days,
  formatDateLabel,
  isMonday,
  toISODate,
  buildStockMap,
  getStockDiff,
} from '../utils/dates';
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
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shipmentInputs, setShipmentInputs] = useState({});

  const dates = useMemo(() => getLast15Days(), []);
  const dateRange = useMemo(() => {
    const startDate = toISODate(dates[dates.length - 1]);
    const endDate = toISODate(dates[0]);
    return { startDate, endDate };
  }, [dates]);

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const displayName = isAdmin
    ? selectedUser?.login || '—'
    : currentUser?.login;

  const stockMap = useMemo(() => buildStockMap(stocks), [stocks]);

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

  const loadData = useCallback(async () => {
    const userId = isAdmin ? selectedUserId : currentUser?.id;
    if (!userId) return;

    setLoading(true);
    try {
      const [productsData, stocksData] = await Promise.all([
        api.getProducts(isAdmin ? userId : null),
        api.getStocks(userId, dateRange.startDate, dateRange.endDate),
      ]);

      setProducts(productsData);
      setStocks(stocksData);

      const inputs = {};
      for (const s of stocksData) {
        inputs[`${s.productId}-${s.date}`] = s.shipments ?? 0;
      }
      setShipmentInputs(inputs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, selectedUserId, currentUser?.id, dateRange]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const getCellData = (productId, dateStr) => {
    return stockMap[`${productId}-${dateStr}`] || null;
  };

  const getQuantity = (productId, dateStr) => {
    const cell = getCellData(productId, dateStr);
    return cell?.quantity ?? null;
  };

  const todayStr = toISODate(dates[0]);

  const storeTotal = useMemo(() => {
    let total = 0;
    for (const product of products) {
      const key = `${product.id}-${todayStr}`;
      const cell = stockMap[key];
      if (!cell) continue;

      if (cell.quantity !== null && cell.quantity !== undefined) {
        total += cell.quantity;
      }

      const shipment =
        shipmentInputs[key] !== undefined
          ? parseInt(shipmentInputs[key], 10) || 0
          : cell.shipments ?? 0;
      total += shipment;
    }
    return total;
  }, [products, stockMap, shipmentInputs, todayStr]);

  const handleShipmentChange = (productId, dateStr, value) => {
    setShipmentInputs((prev) => ({
      ...prev,
      [`${productId}-${dateStr}`]: value,
    }));
  };

  const handleShipmentSave = async (productId, dateStr) => {
    const userId = isAdmin ? selectedUserId : currentUser?.id;
    const key = `${productId}-${dateStr}`;
    const value = shipmentInputs[key];

    if (value === undefined || value === '') return;

    try {
      await api.updateShipment(userId, productId, dateStr, parseInt(value, 10) || 0);
      flash('Отгрузка сохранена');
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderCell = (product, dateIndex) => {
    const dateStr = toISODate(dates[dateIndex]);
    const cell = getCellData(product.id, dateStr);

    if (cell === null) {
      return (
        <td key={product.id} className="stock-cell empty-cell">
          —
        </td>
      );
    }

    const quantity = cell.quantity;
    const hasQuantity = quantity !== null && quantity !== undefined;

    const prevQuantity =
      dateIndex < dates.length - 1
        ? getQuantity(product.id, toISODate(dates[dateIndex + 1]))
        : null;

    const diff =
      dateIndex < dates.length - 1
        ? getStockDiff(hasQuantity ? quantity : null, prevQuantity)
        : null;

    const shipmentKey = `${product.id}-${dateStr}`;
    const shipmentValue =
      shipmentInputs[shipmentKey] !== undefined
        ? shipmentInputs[shipmentKey]
        : cell.shipments ?? '';

    return (
      <td key={product.id} className="stock-cell">
        <div className="stock-cell-inner">
          {diff !== null ? (
            <span className={`stock-diff ${diff >= 0 ? 'positive' : 'negative'}`}>
              {diff > 0 ? `+${diff}` : diff}
            </span>
          ) : (
            <span className="stock-diff empty"> </span>
          )}
          <span className="stock-qty">{hasQuantity ? quantity : '—'}</span>
          <input
            type="number"
            className="stock-shipment-input"
            min="0"
            value={shipmentValue}
            onChange={(e) => handleShipmentChange(product.id, dateStr, e.target.value)}
            onBlur={() => handleShipmentSave(product.id, dateStr)}
          />
        </div>
      </td>
    );
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
            <>
              <div className="store-total">
                На магазине: <strong>{storeTotal}</strong>
              </div>
              <div className="products-table-wrapper stock-grid-wrapper">
                <table className="products-table stock-grid-table">
                  <thead>
                    <tr>
                      <th className="date-col">Дата</th>
                      {products.map((p) => (
                        <th key={p.id}>{p.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dates.map((date, dateIndex) => (
                      <tr
                        key={toISODate(date)}
                        className={isMonday(date) ? 'monday-row' : ''}
                      >
                        <td className="date-col">{formatDateLabel(date)}</td>
                        {products.map((product) => renderCell(product, dateIndex))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
