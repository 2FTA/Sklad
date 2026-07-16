import { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { api } from '../api';
import AdminTopBar from '../components/AdminTopBar';
import {
  getReportMonths,
  getMonthRange,
  getDaysInMonth,
  formatDayMonth,
  getMonthLabel,
  toISODate,
  buildStockMap,
} from '../utils/dates';
import './Dashboard.css';
import './AdminPages.css';
import './ReportsPage.css';

function ReportsPage() {
  const monthOptions = useMemo(() => getReportMonths(), []);

  const [shopUsers, setShopUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value || '');
  const [products, setProducts] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      const { startDate, endDate } = getMonthRange(selectedMonth);
      const [productsData, stocksResponse] = await Promise.all([
        api.getProducts(Number(selectedUserId)),
        api.getStocks(Number(selectedUserId), startDate, endDate),
      ]);

      setProducts(productsData);
      setStockMap(buildStockMap(stocksResponse.stocks || []));
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
            disabled={loading || products.length === 0 || !selectedUserId}
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
        ) : products.length === 0 ? (
          <div className="empty-state">У этого магазина пока нет товаров</div>
        ) : (
          <div className="table-panel">
            <div className="stock-scroll-container">
              <div className="products-table-wrapper stock-grid-wrapper">
                <table className="products-table stock-grid-table">
                  <thead>
                    <tr>
                      <th className="date-col">Дата</th>
                      {products.map((product) => (
                        <th key={product.id}>{product.name}</th>
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
    </div>
  );
}

export default ReportsPage;
