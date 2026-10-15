import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import AdminTopBar from '../components/AdminTopBar';
import { useToast } from '../components/ToastContext';
import './Dashboard.css';
import './AdminPages.css';
import './AdminHouseholdPage.css';
import './HouseholdHistoryPage.css';

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function formatDateOnly(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function HouseholdHistoryPage() {
  const { showToast } = useToast();
  const [shops, setShops] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [history, setHistory] = useState([]);
  const [loadingShops, setLoadingShops] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadShops = useCallback(async () => {
    setLoadingShops(true);
    try {
      const users = await api.getUsers();
      setShops(users.filter((user) => user.role === 'user'));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingShops(false);
    }
  }, [showToast]);

  const loadHistory = useCallback(
    async (userId) => {
      if (!userId) {
        setHistory([]);
        return;
      }

      setLoadingHistory(true);
      try {
        const data = await api.getHouseholdHistory(userId);
        setHistory(data);
      } catch (err) {
        showToast(err.message, 'error');
        setHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  useEffect(() => {
    loadHistory(selectedUserId);
  }, [selectedUserId, loadHistory]);

  const handleShopChange = (event) => {
    setSelectedUserId(event.target.value);
  };

  return (
    <div className="page-layout household-page">
      <AdminTopBar title="История хоз товаров" />

      <div className="content-area admin-content-area household-scroll-content">
        <div className="household-history-controls">
          <label className="household-history-label" htmlFor="household-history-shop">
            Магазин
          </label>
          <select
            id="household-history-shop"
            className="household-history-select"
            value={selectedUserId}
            onChange={handleShopChange}
            disabled={loadingShops}
          >
            <option value="">Выберите магазин</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.login}
              </option>
            ))}
          </select>
        </div>

        {loadingShops ? (
          <div className="loading">Загрузка...</div>
        ) : !selectedUserId ? (
          <div className="empty-state">Выберите магазин для просмотра истории</div>
        ) : loadingHistory ? (
          <div className="loading">Загрузка...</div>
        ) : history.length === 0 ? (
          <div className="empty-state">История пуста</div>
        ) : (
          <div className="products-table-wrapper household-table-wrapper">
            <table className="products-table household-table">
              <thead>
                <tr>
                  <th>Наименование</th>
                  <th className="text-center">Количество</th>
                  <th>Дата запроса</th>
                  <th>Дата отгрузки</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td>{row.productName}</td>
                    <td className="text-center">{row.quantity}</td>
                    <td>{formatDateTime(row.requestDate)}</td>
                    <td>{formatDateOnly(row.shipmentDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default HouseholdHistoryPage;
