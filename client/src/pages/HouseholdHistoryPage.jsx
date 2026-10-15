import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const searchContainerRef = useRef(null);

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

  useEffect(() => {
    const trimmed = searchQuery.trim();

    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearchLoading(false);
      return undefined;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.searchHouseholdHistory(trimmed);
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch (err) {
        showToast(err.message, 'error');
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, showToast]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleShopChange = (event) => {
    setSelectedUserId(event.target.value);
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleSuggestionClick = (suggestion) => {
    setSelectedUserId(String(suggestion.userId));
    setShowSuggestions(false);
  };

  return (
    <div className="page-layout household-page">
      <AdminTopBar title="История хоз товаров" />

      <div className="content-area admin-content-area household-scroll-content">
        <div className="household-history-toolbar">
          <div className="household-history-shop-block">
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

          <div ref={searchContainerRef} className="household-history-search-wrap">
            <div className="household-history-search-field">
              <span className="household-history-search-icon" aria-hidden="true">
                🔍
              </span>
              <input
                type="text"
                className="household-history-search-input"
                placeholder="Поиск товара..."
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                autoComplete="off"
              />
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="suggestions-dropdown" role="listbox">
                {suggestions.map((item) => (
                  <button
                    key={item.userId}
                    type="button"
                    className="suggestion-item"
                    role="option"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSuggestionClick(item)}
                  >
                    <div className="suggestion-header">
                      {item.shopName} Дата отгрузки {formatDateOnly(item.lastShipmentDate)}
                    </div>
                    <div className="suggestion-product">{item.productName}</div>
                  </button>
                ))}
              </div>
            )}

            {searchLoading && searchQuery.trim().length >= 2 && (
              <div className="household-history-search-hint">Поиск...</div>
            )}
          </div>

          <div className="household-history-toolbar-spacer" aria-hidden="true" />
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
