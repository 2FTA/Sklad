import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
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
      await loadRequests();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const hasRequests = groups.some((group) => group.requests.length > 0);

  return (
    <div className="page-layout">
      <AdminTopBar title="Хоз товары" />

      <div className="content-area admin-content-area">
        {loading ? (
          <div className="loading">Загрузка...</div>
        ) : !hasRequests ? (
          <div className="empty-state">Запросов пока нет</div>
        ) : (
          <div className="household-groups">
            {groups.map((group) =>
              group.requests.length === 0 ? null : (
                <section key={group.userId} className="household-group">
                  <h2 className="household-group-title">{group.shopName}</h2>
                  <div className="products-table-wrapper household-table-wrapper">
                    <table className="products-table household-table">
                      <thead>
                        <tr>
                          <th>Наименование</th>
                          <th className="text-center">Количество</th>
                          <th>Дата запроса</th>
                          <th className="text-center">Действие</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.requests.map((request) => (
                          <tr key={request.id}>
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
