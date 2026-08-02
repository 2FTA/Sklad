import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import AdminTopBar from '../components/AdminTopBar';
import { useToast } from '../components/ToastContext';
import './Dashboard.css';
import './AdminPages.css';
import './ExpiredPage.css';

function formatDisplayDate(value) {
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

function ExpiredPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadExpired = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getExpiredLots();
      setItems(data);
    } catch (err) {
      showToast(err.message, 'error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadExpired();
  }, [loadExpired]);

  return (
    <div className="page-layout">
      <AdminTopBar title="Просрочка" />

      <div className="content-area admin-content-area">
        <div className="expired-toolbar">
          <button
            type="button"
            className="btn-sm btn-update"
            onClick={loadExpired}
            disabled={loading}
          >
            Обновить
          </button>
        </div>

        {loading ? (
          <div className="loading">Загрузка...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">Просрочек нет</div>
        ) : (
          <div className="products-table-wrapper expired-table-wrapper">
            <table className="products-table expired-table">
              <thead>
                <tr>
                  <th>Магазин</th>
                  <th>Наименование</th>
                  <th className="text-center">Количество</th>
                  <th>Дата отгрузки</th>
                  <th className="text-center">Дней просрочено</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={`${item.shopName}-${item.productName}-${item.receivedDate}-${index}`}>
                    <td>{item.shopName}</td>
                    <td>{item.productName}</td>
                    <td className="text-center expired-num">{item.quantity}</td>
                    <td>{formatDisplayDate(item.receivedDate)}</td>
                    <td className="text-center expired-overdue">{item.daysOverdue}</td>
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

export default ExpiredPage;
