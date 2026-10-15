import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { downloadBlob } from '../utils/download';
import { toISODate } from '../utils/dates';
import AdminTopBar from '../components/AdminTopBar';
import { useToast } from '../components/ToastContext';
import './Dashboard.css';
import './AdminPages.css';
import './AdminHouseholdPage.css';

function formatRequestDate(value) {
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

function AdminHouseholdPage() {
  const { showToast } = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedShopIds, setSelectedShopIds] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [exporting, setExporting] = useState(false);

  const todayStr = useMemo(() => toISODate(new Date()), []);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getHouseholdRequests();
      setGroups(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.deleteHouseholdRequest(id);
      showToast('Запрос удалён', 'success');
      setSelectedItemIds((prev) => prev.filter((itemId) => itemId !== id));
      await loadRequests();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleShopChange = (userId) => {
    setSelectedShopIds((prev) => {
      if (prev.includes(userId)) {
        const group = groups.find((g) => g.userId === userId);
        if (group) {
          const shopRequestIds = new Set(group.requests.map((request) => request.id));
          setSelectedItemIds((itemIds) =>
            itemIds.filter((itemId) => !shopRequestIds.has(itemId))
          );
        }
        return prev.filter((id) => id !== userId);
      }
      return [...prev, userId];
    });
  };

  const handleItemChange = (requestId) => {
    setSelectedItemIds((prev) => {
      if (prev.includes(requestId)) {
        return prev.filter((id) => id !== requestId);
      }
      return [...prev, requestId];
    });
  };

  const hasExportSelection = useMemo(() => {
    if (selectedShopIds.length === 0 || selectedItemIds.length === 0) {
      return false;
    }

    const selectedShopSet = new Set(selectedShopIds);
    return groups.some(
      (group) =>
        selectedShopSet.has(group.userId) &&
        group.requests.some((request) => selectedItemIds.includes(request.id))
    );
  }, [groups, selectedShopIds, selectedItemIds]);

  const handleExport = async () => {
    if (!hasExportSelection) return;

    const selectedShopSet = new Set(selectedShopIds);
    const shops = groups
      .filter((group) => selectedShopSet.has(group.userId))
      .map((group) => ({
        shopName: group.shopName,
        items: group.requests
          .filter((request) => selectedItemIds.includes(request.id))
          .map((request) => ({
            name: request.productName,
            quantity: request.quantity,
          })),
      }))
      .filter((shop) => shop.items.length > 0);

    if (shops.length === 0) {
      showToast('Выберите хотя бы один товар', 'error');
      return;
    }

    setExporting(true);
    try {
      const blob = await api.exportHousehold({ shops });
      downloadBlob(blob, `Хозтовары_${todayStr}.xlsx`);
    } catch (err) {
      showToast(err.message || 'Не удалось экспортировать данные', 'error');
    } finally {
      setExporting(false);
    }
  };

  const hasRequests = groups.some((group) => group.requests.length > 0);

  return (
    <div className="page-layout household-page">
      <AdminTopBar
        title="Хоз товары"
        leftExtra={
          <Link to="/admin/household-history" className="btn-export household-history-link">
            История
          </Link>
        }
      />

      <div className="content-area admin-content-area household-scroll-content">
        {!loading && hasRequests && (
          <div className="household-toolbar">
            <button
              type="button"
              className="btn-export"
              onClick={handleExport}
              disabled={!hasExportSelection || exporting}
            >
              {exporting ? 'Экспорт...' : 'Экспорт'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading">Загрузка...</div>
        ) : !hasRequests ? (
          <div className="empty-state">Запросов пока нет</div>
        ) : (
          <div className="household-groups">
            {groups.map((group) =>
              group.requests.length === 0 ? null : (
                <section key={group.userId} className="household-group">
                  <div className="household-group-header">
                    <h2 className="household-group-title">{group.shopName}</h2>
                    <input
                      type="checkbox"
                      className="household-checkbox household-shop-checkbox"
                      checked={selectedShopIds.includes(group.userId)}
                      onChange={() => handleShopChange(group.userId)}
                      aria-label={`Выбрать магазин ${group.shopName}`}
                    />
                  </div>
                  <div className="products-table-wrapper household-table-wrapper">
                    <table className="products-table household-table">
                      <thead>
                        <tr>
                          <th className="text-center household-check-col" aria-label="Выбор" />
                          <th>Наименование</th>
                          <th className="text-center">Количество</th>
                          <th>Дата запроса</th>
                          <th className="text-center">Действие</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.requests.map((request) => (
                          <tr key={request.id}>
                            <td className="text-center household-check-col">
                              <input
                                type="checkbox"
                                className="household-checkbox"
                                checked={selectedItemIds.includes(request.id)}
                                disabled={!selectedShopIds.includes(group.userId)}
                                onChange={() => handleItemChange(request.id)}
                                aria-label={`Выбрать ${request.productName}`}
                              />
                            </td>
                            <td>{request.productName}</td>
                            <td className="text-center">{request.quantity}</td>
                            <td>{formatRequestDate(request.requestDate)}</td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn-sm btn-delete"
                                onClick={() => handleDelete(request.id)}
                                disabled={deletingId === request.id}
                              >
                                {deletingId === request.id ? 'Удаление...' : 'Удалить'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminHouseholdPage;
