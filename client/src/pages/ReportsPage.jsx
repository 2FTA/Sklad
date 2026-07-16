import { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { api } from '../api';
import AdminTopBar from '../components/AdminTopBar';
import {
  getReportMonths,
  getDaysInMonth,
  formatDayMonth,
  getMonthLabel,
  toISODate,
  buildStockMap,
} from '../utils/dates';
import './Dashboard.css';
import './AdminPages.css';
import './ReportsPage.css';

function DeleteProductModal({ productName, onConfirm, onClose, loading, error }) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(password);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Удалить из отчета</h3>
        <p className="modal-text">
          Товар «{productName}» будет удален только из этого отчета. Глобальный список
          товаров не изменится.
        </p>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Пароль администратора</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              Отмена
            </button>
            <button type="submit" className="btn-sm btn-delete" disabled={loading}>
              {loading ? 'Удаление...' : 'Удалить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReportsPage() {
  const monthOptions = useMemo(() => getReportMonths(), []);

  const [shopUsers, setShopUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value || '');
  const [reportId, setReportId] = useState(null);
  const [reportExists, setReportExists] = useState(false);
  const [products, setProducts] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const days = useMemo(
    () => (selectedMonth ? getDaysInMonth(selectedMonth) : []),
    [selectedMonth]
  );

  const selectedShop = shopUsers.find((u) => u.id === Number(selectedUserId));

  const loadShops = useCallback(async () => {
    try {
      const users = await api.getUsers();
      const shops = users.filter((u) => u.role === 'user');
      setShopUsers(shops);
      if (shops.length > 0) {
        setSelectedUserId(String(shops[0].id));
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, []);

  const loadReport = useCallback(async () => {
    if (!selectedUserId || !selectedMonth) return;

    setLoading(true);
    setError('');

    try {
      const data = await api.getReport(Number(selectedUserId), selectedMonth);

      if (!data.exists) {
        setReportExists(false);
        setReportId(null);
        setProducts([]);
        setStockMap({});
        return;
      }

      setReportExists(true);
      setReportId(data.report.id);
      setProducts(data.products.map((p) => ({ id: p.id, name: p.name })));
      setStockMap(buildStockMap(data.stocks || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedUserId, selectedMonth]);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  useEffect(() => {
    if (selectedUserId && selectedMonth) {
      loadReport();
    }
  }, [selectedUserId, selectedMonth, loadReport]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');

    try {
      await api.generateReport(Number(selectedUserId), selectedMonth);
      await loadReport();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteProduct = async (password) => {
    if (!deleteTarget || !reportId) return;

    setDeleteLoading(true);
    setDeleteError('');

    try {
      await api.deleteReportProduct(reportId, deleteTarget.id, password);
      setDeleteTarget(null);
      await loadReport();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const getCellData = (productId, dateStr) => {
    return stockMap[`${productId}-${dateStr}`] || null;
  };

  const getCellValues = (productId, dateIndex) => {
    const dateStr = toISODate(days[dateIndex]);
    const cell = getCellData(productId, dateStr);

    if (!cell) {
      return { sales: null, quantity: null, shipments: null, empty: true };
    }

    const quantity = cell.quantity;
    const hasQuantity = quantity !== null && quantity !== undefined;
    const shipments = cell.shipments ?? 0;

    let sales = null;
    if (dateIndex < days.length - 1) {
      const nextDateStr = toISODate(days[dateIndex + 1]);
      const nextQuantity = getCellData(productId, nextDateStr)?.quantity ?? null;

      if (hasQuantity && nextQuantity !== null && nextQuantity !== undefined) {
        sales = quantity + shipments - nextQuantity;
      }
    }

    return {
      sales,
      quantity: hasQuantity ? quantity : null,
      shipments,
      empty: false,
    };
  };

  const handleExport = () => {
    const shopName = selectedShop?.login || 'магазин';
    const monthLabel = getMonthLabel(selectedMonth);

    const headerRow = ['Дата', ...products.map((p) => p.name)];
    const rows = days.map((date, dateIndex) => {
      const row = [formatDayMonth(date)];

      for (const product of products) {
        const { sales, quantity, shipments, empty } = getCellValues(product.id, dateIndex);

        if (empty) {
          row.push('');
          continue;
        }

        const salesText = sales !== null ? String(sales) : '';
        const qtyText = quantity !== null ? String(quantity) : '—';
        const shipText = String(shipments ?? 0);
        row.push(`${salesText}\n${qtyText}\n${shipText}`);
      }

      return row;
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Отчет');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `Отчет_${shopName}_${monthLabel.replace(' ', '_')}.xlsx`
    );
  };

  const renderCell = (product, dateIndex) => {
    const { sales, quantity, shipments, empty } = getCellValues(product.id, dateIndex);

    if (empty) {
      return (
        <td key={product.id} className="stock-cell empty-cell">
          —
        </td>
      );
    }

    return (
      <td key={product.id} className="stock-cell">
        <div className="stock-cell-inner">
          {sales !== null ? (
            <span className={`stock-diff ${sales >= 0 ? 'positive' : 'negative'}`}>
              {sales > 0 ? `+${sales}` : sales}
            </span>
          ) : (
            <span className="stock-diff empty"> </span>
          )}
          <span className="stock-qty">{quantity !== null ? quantity : '—'}</span>
          <span className="stock-shipment-readonly">{shipments}</span>
        </div>
      </td>
    );
  };

  return (
    <div className="page-layout">
      <AdminTopBar title="Отчеты по складам" />

      <div className="content-area admin-content-area">
        <div className="reports-toolbar">
          <select
            className="reports-select"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            disabled={shopUsers.length === 0}
          >
            {shopUsers.length === 0 ? (
              <option value="">Нет магазинов</option>
            ) : (
              shopUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.login}
                </option>
              ))
            )}
          </select>

          <select
            className="reports-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn-export"
            onClick={handleExport}
            disabled={loading || !reportExists || products.length === 0}
          >
            Экспорт
          </button>
        </div>

        {error && (
          <div className="error-banner" onClick={() => setError('')}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading">Загрузка...</div>
        ) : !reportExists ? (
          <div className="reports-create-panel">
            <p>Отчет за выбранный месяц еще не создан.</p>
            <p className="reports-create-hint">
              При создании будет сохранен снимок текущего списка товаров и данных склада
              за этот месяц.
            </p>
            <button
              type="button"
              className="btn-create-report"
              onClick={handleGenerate}
              disabled={generating || !selectedUserId}
            >
              {generating ? 'Создание...' : 'Создать отчет'}
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">В этом отчете нет товаров</div>
        ) : (
          <div className="table-panel">
            <div className="stock-scroll-container">
              <div className="products-table-wrapper stock-grid-wrapper">
                <table className="products-table reports-table">
                  <thead>
                    <tr>
                      <th className="date-col">Дата</th>
                      {products.map((product) => (
                        <th key={product.id} className="reports-product-col">
                          <div className="reports-product-header">
                            <span>{product.name}</span>
                            <button
                              type="button"
                              className="btn-delete-from-report"
                              onClick={() => {
                                setDeleteError('');
                                setDeleteTarget(product);
                              }}
                              title="Удалить из отчета"
                            >
                              ✕
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((date, dateIndex) => (
                      <tr key={toISODate(date)}>
                        <td className="date-col">{formatDayMonth(date)}</td>
                        {products.map((product) => renderCell(product, dateIndex))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {deleteTarget && (
        <DeleteProductModal
          productName={deleteTarget.name}
          onConfirm={handleDeleteProduct}
          onClose={() => {
            setDeleteTarget(null);
            setDeleteError('');
          }}
          loading={deleteLoading}
          error={deleteError}
        />
      )}
    </div>
  );
}

export default ReportsPage;
