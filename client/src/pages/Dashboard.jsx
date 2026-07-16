import { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { api } from '../api';
import AdminTopBar from '../components/AdminTopBar';
import {
  getAdminStockDays,
  getToday,
  formatDateFull,
  formatDateLabel,
  isMonday,
  toISODate,
  buildStockMap,
} from '../utils/dates';
import './Dashboard.css';
import './AdminPages.css';

function Dashboard() {
  const today = useMemo(() => getToday(), []);
  const todayStr = toISODate(today);
  const todayLabel = formatDateFull(today);
  const dates = useMemo(() => getAdminStockDays(), []);
  const dateRange = useMemo(() => {
    const startDate = toISODate(dates[dates.length - 1]);
    const endDate = toISODate(dates[0]);
    const totalDate = toISODate(dates[1]);
    return { startDate, endDate, totalDate };
  }, [dates]);

  const [activeView, setActiveView] = useState('summary');
  const [shopUsers, setShopUsers] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [globalProducts, setGlobalProducts] = useState([]);
  const [shipmentMap, setShipmentMap] = useState({});
  const [warehouseInputs, setWarehouseInputs] = useState({});
  const [motorInputs, setMotorInputs] = useState({});

  const [userProducts, setUserProducts] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [storeTotal, setStoreTotal] = useState(0);
  const [shipmentInputs, setShipmentInputs] = useState({});

  const selectedUser = shopUsers.find((u) => u.id === activeView);
  const storeCapacity =
    selectedUser?.role === 'user' ? (selectedUser.capacity ?? 1000) : null;
  const freeSpace = storeCapacity !== null ? storeCapacity - storeTotal : null;
  const stockMap = useMemo(() => buildStockMap(stocks), [stocks]);

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.getUsers();
      setShopUsers(data.filter((u) => u.role === 'user'));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadSummaryData = useCallback(async () => {
    setLoading(true);
    try {
      const [productsData, shipmentsData] = await Promise.all([
        api.getGlobalProducts(),
        api.getTodayShipments(todayStr),
      ]);

      setGlobalProducts(productsData);

      const map = {};
      for (const row of shipmentsData.shipments || []) {
        map[`${row.userId}-${row.globalProductId}`] = row.shipments ?? 0;
      }
      setShipmentMap(map);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  const loadUserData = useCallback(async () => {
    if (typeof activeView !== 'number') return;

    setLoading(true);
    try {
      const [productsData, stocksResponse] = await Promise.all([
        api.getProducts(activeView),
        api.getStocks(
          activeView,
          dateRange.startDate,
          dateRange.endDate,
          dateRange.totalDate
        ),
      ]);

      setUserProducts(productsData);
      setStocks(stocksResponse.stocks || []);
      setStoreTotal(stocksResponse.storeTotal ?? 0);

      const inputs = {};
      for (const s of stocksResponse.stocks || []) {
        inputs[`${s.productId}-${s.date}`] = s.shipments ?? 0;
      }
      setShipmentInputs(inputs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeView, dateRange]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (activeView === 'summary') {
      loadSummaryData();
    } else {
      loadUserData();
    }
  }, [activeView, loadSummaryData, loadUserData]);

  const handleSelectView = (view) => {
    setActiveView(view);
    setSidebarOpen(false);
    setError('');
    setSuccess('');
  };

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const getSummaryShipment = (userId, globalProductId) => {
    return shipmentMap[`${userId}-${globalProductId}`] ?? 0;
  };

  const getRowTotal = (globalProductId) => {
    return shopUsers.reduce(
      (sum, user) => sum + getSummaryShipment(user.id, globalProductId),
      0
    );
  };

  const parseInput = (value) => {
    if (value === '' || value === undefined || value === null) return null;
    const num = parseInt(value, 10);
    return isNaN(num) ? null : num;
  };

  const getRowCalcs = (globalProductId) => {
    const total = getRowTotal(globalProductId);
    const warehouse = parseInput(warehouseInputs[globalProductId]);
    const motor = parseInput(motorInputs[globalProductId]);
    const afterShip = warehouse !== null ? warehouse - total : null;
    const overall =
      afterShip !== null && motor !== null ? afterShip + motor : null;

    return { total, warehouse, motor, afterShip, overall };
  };

  const toExcelValue = (value) => {
    if (value === null || value === undefined) return undefined;
    return value;
  };

  const handleExportSummary = () => {
    const headers = [
      'Товар',
      ...shopUsers.map((u) => u.login),
      'итого',
      'склад',
      'склад после отг',
      'склад Моторная',
      'общий остаток',
    ];

    const rows = globalProducts.map((product) => {
      const { total, warehouse, motor, afterShip, overall } = getRowCalcs(product.id);

      return [
        product.name,
        ...shopUsers.map((u) => getSummaryShipment(u.id, product.id)),
        total,
        toExcelValue(warehouse),
        toExcelValue(afterShip),
        toExcelValue(motor),
        toExcelValue(overall),
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Сводка');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `Сводка_${todayLabel}.xlsx`
    );
  };

  const getCellData = (productId, dateStr) => {
    return stockMap[`${productId}-${dateStr}`] || null;
  };

  const getShipments = (productId, dateStr) => {
    const key = `${productId}-${dateStr}`;
    const cell = getCellData(productId, dateStr);
    if (shipmentInputs[key] !== undefined) {
      return parseInt(shipmentInputs[key], 10) || 0;
    }
    return cell?.shipments ?? 0;
  };

  const handleShipmentChange = (productId, dateStr, value) => {
    if (dateStr !== todayStr) return;

    setShipmentInputs((prev) => ({
      ...prev,
      [`${productId}-${dateStr}`]: value,
    }));
  };

  const handleShipmentSave = async (productId, dateStr) => {
    if (dateStr !== todayStr) return;

    const key = `${productId}-${dateStr}`;
    const value = shipmentInputs[key];

    if (value === undefined || value === '') return;

    try {
      await api.updateShipment(
        activeView,
        productId,
        dateStr,
        parseInt(value, 10) || 0
      );
      flash('Отгрузка сохранена');
      await loadUserData();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderUserCell = (product, dateIndex) => {
    const dateStr = toISODate(dates[dateIndex]);
    const cell = getCellData(product.id, dateStr);

    if (cell === null) {
      return (
        <td key={product.id} className="stock-cell empty-cell">
          —
        </td>
      );
    }

    const quantity = cell.quantity;
    const hasQuantity = quantity !== null && quantity !== undefined;

    let sales = null;
    if (dateIndex >= 2) {
      const nextDateStr = toISODate(dates[dateIndex - 1]);
      const nextQuantity = getCellData(product.id, nextDateStr)?.quantity ?? null;

      if (hasQuantity && nextQuantity !== null && nextQuantity !== undefined) {
        const currentShipments = getShipments(product.id, dateStr);
        sales = quantity + currentShipments - nextQuantity;
      }
    }

    const shipmentKey = `${product.id}-${dateStr}`;
    const shipmentValue =
      shipmentInputs[shipmentKey] !== undefined
        ? shipmentInputs[shipmentKey]
        : cell.shipments ?? '';
    const isToday = dateStr === todayStr;
    const displayShipment =
      shipmentValue === '' || shipmentValue === undefined ? '—' : shipmentValue;

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
          <span className="stock-qty">{hasQuantity ? quantity : '—'}</span>
          {isToday ? (
            <input
              type="number"
              className="stock-shipment-input"
              min="0"
              value={shipmentValue}
              onChange={(e) =>
                handleShipmentChange(product.id, dateStr, e.target.value)
              }
              onBlur={() => handleShipmentSave(product.id, dateStr)}
            />
          ) : (
            <span className="stock-shipment-readonly">{displayShipment}</span>
          )}
        </div>
      </td>
    );
  };

  const topBarTitle =
    activeView === 'summary'
      ? todayLabel
      : `Склад пользователя: ${selectedUser?.login || '—'}`;

  const renderSummaryView = () => {
    if (globalProducts.length === 0) {
      return <div className="empty-state">Товаров пока нет</div>;
    }
    if (shopUsers.length === 0) {
      return <div className="empty-state">Нет магазинов для отображения</div>;
    }

    return (
      <div className="table-panel">
        <div className="stock-scroll-container">
          <div className="products-table-wrapper summary-table-wrapper">
          <table className="products-table summary-table">
            <thead>
              <tr>
                <th className="product-name-col">Товар</th>
                {shopUsers.map((user) => (
                  <th key={user.id}>{user.login}</th>
                ))}
                <th>итого</th>
                <th>склад</th>
                <th>склад после отг</th>
                <th>склад Моторная</th>
                <th>общий остаток</th>
              </tr>
            </thead>
            <tbody>
              {globalProducts.map((product) => {
                const { total, afterShip, overall } = getRowCalcs(product.id);

                return (
                  <tr key={product.id}>
                    <td className="product-name-col">{product.name}</td>
                    {shopUsers.map((user) => (
                      <td key={user.id} className="summary-num">
                        {getSummaryShipment(user.id, product.id)}
                      </td>
                    ))}
                    <td className="summary-num summary-total">{total}</td>
                    <td>
                      <input
                        type="number"
                        className="summary-input"
                        value={warehouseInputs[product.id] ?? ''}
                        onChange={(e) =>
                          setWarehouseInputs({
                            ...warehouseInputs,
                            [product.id]: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td className="summary-num">
                      {afterShip !== null ? afterShip : '—'}
                    </td>
                    <td>
                      <input
                        type="number"
                        className="summary-input"
                        value={motorInputs[product.id] ?? ''}
                        onChange={(e) =>
                          setMotorInputs({
                            ...motorInputs,
                            [product.id]: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td className="summary-num summary-overall">
                      {overall !== null ? overall : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    );
  };

  const renderUserView = () => {
    if (userProducts.length === 0) {
      return <div className="empty-state">У этого пользователя пока нет товаров</div>;
    }

    return (
      <div className="table-panel">
        <div className="store-total">
          <span>
            На магазине: <strong>{storeTotal}</strong>
          </span>
          {storeCapacity !== null && (
            <>
              <span className="store-stat-divider" />
              <span>
                Вместимость: <strong>{storeCapacity}</strong>
              </span>
              <span className="store-stat-divider" />
              <span>
                Свободное место:{' '}
                <strong
                  className={freeSpace >= 0 ? 'free-space-ok' : 'free-space-over'}
                >
                  {freeSpace}
                </strong>
              </span>
            </>
          )}
        </div>
        <div className="stock-scroll-container">
          <div className="products-table-wrapper stock-grid-wrapper">
            <table className="products-table stock-grid-table">
              <thead>
                <tr>
                  <th className="date-col">Дата</th>
                  {userProducts.map((p) => (
                    <th key={p.id}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dates.map((date, dateIndex) => (
                  <tr
                    key={toISODate(date)}
                    className={isMonday(date) ? 'monday-row' : ''}
                  >
                    <td className="date-col">{formatDateLabel(date)}</td>
                    {userProducts.map((product) => renderUserCell(product, dateIndex))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard">
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Магазины</h2>
        </div>
        <div className="user-list">
          <div
            className={`user-item ${activeView === 'summary' ? 'active' : ''}`}
            onClick={() => handleSelectView('summary')}
          >
            <span className="user-item-name">Сводка</span>
          </div>
          {shopUsers.map((user) => (
            <div
              key={user.id}
              className={`user-item ${activeView === user.id ? 'active' : ''}`}
              onClick={() => handleSelectView(user.id)}
            >
              <span className="user-item-name">{user.login}</span>
            </div>
          ))}
        </div>
      </aside>

      <main className="main-content with-sidebar">
        <AdminTopBar
          title={topBarTitle}
          onMenuClick={() => setSidebarOpen(true)}
          leftExtra={
            activeView === 'summary' ? (
              <button
                type="button"
                className="btn-export"
                onClick={handleExportSummary}
                disabled={loading}
              >
                Экспорт
              </button>
            ) : null
          }
        />

        <div className="content-area admin-content-area">
          {error && (
            <div className="error-banner" onClick={() => setError('')}>
              {error}
            </div>
          )}
          {success && <div className="success-banner">{success}</div>}

          {loading ? (
            <div className="loading">Загрузка...</div>
          ) : activeView === 'summary' ? (
            renderSummaryView()
          ) : (
            renderUserView()
          )}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
