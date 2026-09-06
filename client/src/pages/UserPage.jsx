import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearAuth, getStoredUser } from '../api';
import { useToast } from '../components/ToastContext';
import { formatDateFull, getToday, getTomorrowISO, toISODate } from '../utils/dates';
import './Dashboard.css';
import './UserPage.css';

function UserPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const isMotor = currentUser?.role === 'motor';
  const today = useMemo(() => getToday(), []);
  const todayLabel = formatDateFull(today);

  const [products, setProducts] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const productsData = await api.getProducts();

      setProducts(productsData);

      const inputs = {};
      productsData.forEach((p) => {
        inputs[p.id] = '';
      });

      setQuantities(inputs);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const stocks = products.map((p) => ({
        productId: p.id,
        quantity: parseInt(quantities[p.id], 10) || 0,
      }));

      await api.saveStocks(
        currentUser.id,
        isMotor ? toISODate(today) : getTomorrowISO(),
        stocks
      );
      showToast('Остатки сохранены', 'success');
      await loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="user-page-layout">
      <div className="top-bar">
        <h1>Мой склад</h1>
        <div className="top-bar-actions">
          <span className="user-badge">{currentUser?.login}</span>
          <button className="btn-logout" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </div>

      <div className="content-area user-page-content">
        <div className="user-date-label">Дата: {todayLabel}</div>

        {loading ? (
          <div className="loading">Загрузка...</div>
        ) : products.length === 0 ? (
          <div className="empty-state">Список товаров пуст</div>
        ) : (
          <form className="user-stock-form" onSubmit={handleSave}>
            <ul className="user-product-list">
              {products.map((product) => (
                <li key={product.id} className="user-product-item">
                  <span className="user-product-name">{product.name}</span>
                  <input
                    type="number"
                    className="user-qty-input"
                    min="0"
                    value={quantities[product.id] ?? ''}
                    onChange={(e) =>
                      setQuantities({ ...quantities, [product.id]: e.target.value })
                    }
                  />
                </li>
              ))}
            </ul>
            <button type="submit" className="btn-primary btn-save" disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default UserPage;
