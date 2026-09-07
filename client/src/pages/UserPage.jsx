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
  const isUser = currentUser?.role === 'user';
  const today = useMemo(() => getToday(), []);
  const todayLabel = formatDateFull(today);

  const [activeCategory, setActiveCategory] = useState('beer');
  const [products, setProducts] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isBeer = activeCategory === 'beer';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const productsData = isMotor
        ? await api.getProducts()
        : await api.getProducts(undefined, activeCategory);

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
  }, [activeCategory, isMotor, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCategoryChange = (category) => {
    if (category === activeCategory || isMotor) return;
    setActiveCategory(category);
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (isBeer || isMotor) {
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
      } else {
        const items = products
          .map((p) => ({
            productId: p.globalProductId,
            quantity: parseInt(quantities[p.id], 10) || 0,
          }))
          .filter((item) => item.quantity > 0);

        if (items.length === 0) {
          showToast('Укажите количество хотя бы для одного товара', 'error');
          return;
        }

        await api.createHouseholdRequests(items);
        showToast('Запрос отправлен', 'success');
      }

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
        {isUser && (
          <div className="product-category-tabs user-category-tabs">
            <button
              type="button"
              className={`product-category-tab ${isBeer ? 'active' : ''}`}
              onClick={() => handleCategoryChange('beer')}
            >
              Пиво
            </button>
            <button
              type="button"
              className={`product-category-tab ${!isBeer ? 'active' : ''}`}
              onClick={() => handleCategoryChange('household')}
            >
              Хоз товары
            </button>
          </div>
        )}

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
              {saving ? 'Сохранение...' : isBeer || isMotor ? 'Сохранить' : 'Отправить запрос'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default UserPage;
