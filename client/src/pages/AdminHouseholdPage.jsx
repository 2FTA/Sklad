import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [selectedShopId, setSelectedShopId] = useState(null);
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
    setSelectedShopId((prev) => (prev === userId ? null : userId));
    setSelectedItemIds([]);
  };

  const handleItemChange = (requestId) => {
    setSelectedItemIds((prev) => {
      if (prev.includes(requestId)) {
        return prev.filter((id) => id !== requestId);
      }
      return [...prev, requestId];
    });
  };

  const canExport = selectedShopId !== null && selectedItemIds.length > 0;

  const handleExport = async () => {
    if (!canExport) return;

    const selectedGroup = groups.find((group) => group.userId === selectedShopId);
    if (!selectedGroup) {
      showToast('Магазин не найден', 'error');
      return;
    }

    const items = selectedGroup.requests
      .filter((request) => selectedItemIds.includes(request.id))
      .map((request) => ({
        name: request.productName,
        quantity: request.quantity,
      }));

    if (items.length === 0) {
      showToast('Выберите хотя бы один товар', 'error');
      return;
    }

    setExporting(true);
    try {
      const blob = await api.exportHousehold({
        shopName: selectedGroup.shopName,
        items,
      });

      const safeShop = selectedGroup.shopName.replace(/[/\\?%*:|"<>]/g, '_');
      downloadBlob(blob, `Хозтовары_${safeShop}_${todayStr}.xlsx`);
    } catch (err) {
      showToast(err.message || 'Не удалось экспортировать данные', 'error');
    } finally {
      setExporting(false);
    }
  };

  const hasRequests = groups.some((group) => group.requests.length > 0);

  return (
    <div className="page-layout household-page">
      <AdminTopBar title="Хоз товары" />

      <div className="content-area admin-content-area household-scroll-content">
        {!loading && hasRequests && (
          <div className="household-toolbar">
            <button
              type="button"
              className="btn-export"
              onClick={handleExport}
              disabled={!canExport || exporting}
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
                      className="household-shop-checkbox"
                      checked={selectedShopId === group.userId}
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
                                checked={selectedItemIds.includes(request.id)}
                                disabled={selectedShopId !== group.userId}
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
