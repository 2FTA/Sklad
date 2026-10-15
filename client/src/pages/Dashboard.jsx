import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api';
import { downloadBlob } from '../utils/download';
import AdminTopBar from '../components/AdminTopBar';
import SimplifiedMotorReport from '../components/SimplifiedMotorReport';
import { useToast } from '../components/ToastContext';
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
  const { showToast } = useToast();
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
  const [motorUser, setMotorUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [globalProducts, setGlobalProducts] = useState([]);
  const [shipmentMap, setShipmentMap] = useState({});
  const [warehouseInputs, setWarehouseInputs] = useState({});
  const [motorInputs, setMotorInputs] = useState({});

  const [userProducts, setUserProducts] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [shipmentInputs, setShipmentInputs] = useState({});
  const [movementInputs, setMovementInputs] = useState({});
  const [returnInputs, setReturnInputs] = useState({});
  const [isEditingRemainder, setIsEditingRemainder] = useState(false);
  const [editedRemainders, setEditedRemainders] = useState({});
  const [savingRemainders, setSavingRemainders] = useState(false);
  const [exportingSummary, setExportingSummary] = useState(false);

  const isMotorView = motorUser != null && activeView === motorUser.id;
  const selectedUser = isMotorView
    ? motorUser
    : shopUsers.find((u) => u.id === activeView);
  const storeCapacity =
    selectedUser?.role === 'user' ? (selectedUser.capacity ?? 1000) : null;
  const stockMap = useMemo(() => buildStockMap(stocks), [stocks]);

  const productWeightMap = useMemo(() => {
    const map = {};
    for (const row of stocks) {
      if (row.weight != null) {
        map[row.productId] = row.weight;
      }
    }
    return map;
  }, [stocks]);

  const readShipmentTotal = (productId, dateStr) => {
    const key = `${productId}-${dateStr}`;
    if (Object.prototype.hasOwnProperty.call(shipmentInputs, key)) {
      const raw = shipmentInputs[key];
      if (raw === '' || raw === null || raw === undefined) {
        return 0;
      }
      return parseInt(String(raw), 10) || 0;
    }
    return parseInt(stockMap[key]?.shipments ?? 0, 10) || 0;
  };

  const readTodayQuantityTotal = (productId) => {
    if (isEditingRemainder) {
      const edited = editedRemainders[productId];
      if (edited !== undefined && edited !== '') {
        return parseInt(edited, 10) || 0;
      }
    }
    return parseInt(stockMap[`${productId}-${todayStr}`]?.quantity ?? 0, 10) || 0;
  };

  const totalOnStore = userProducts.reduce((sum, product) => {
    if (productWeightMap[product.id] !== '1л') {
      return sum;
    }
    return sum + readTodayQuantityTotal(product.id);
  }, 0);

  const totalShipments = userProducts.reduce((sum, product) => {
    if (productWeightMap[product.id] !== '1л') {
      return sum;
    }
    return sum + readShipmentTotal(product.id, todayStr);
  }, 0);

  const freeSpace =
    storeCapacity !== null ? storeCapacity - totalOnStore - totalShipments : null;

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.getUsers();
      setShopUsers(data.filter((u) => u.role === 'user'));
      setMotorUser(data.find((u) => u.role === 'motor') || null);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [showToast]);

  const loadSummaryData = useCallback(async () => {
    setLoading(true);
    try {
      const [productsData, shipmentsData, summaryData] = await Promise.all([
        api.getGlobalProducts(),
        api.getTodayShipments(todayStr),
        api.getSummary(todayStr),
      ]);

      setGlobalProducts(productsData);

      const map = {};
      for (const row of shipmentsData.shipments || []) {
        map[`${row.userId}-${row.globalProductId}`] = row.shipments ?? 0;
      }
      setShipmentMap(map);

      const warehouseInit = {};
      const motorInit = {};
      for (const row of summaryData || []) {
        if (row.warehouse !== null && row.warehouse !== undefined) {
          warehouseInit[row.productId] = row.warehouse;
        }
        if (row.warehouseMotornaya !== null && row.warehouseMotornaya !== undefined) {
          motorInit[row.productId] = row.warehouseMotornaya;
        }
      }
      setWarehouseInputs(warehouseInit);
      setMotorInputs(motorInit);
    } catch (err) {
      showToast(err.message, 'error');
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

      const shipmentInit = {};
      const movementInit = {};
      const returnInit = {};

      for (const s of stocksResponse.stocks || []) {
        if (s.date !== todayStr) continue;
        const key = `${s.productId}-${s.date}`;
        shipmentInit[key] =
          s.shipments === 0 || s.shipments == null ? '' : s.shipments;
        movementInit[key] = s.movement === 0 || s.movement == null ? '' : s.movement;
        returnInit[key] = s.return === 0 || s.return == null ? '' : s.return;
      }

      setShipmentInputs(shipmentInit);
      setMovementInputs(movementInit);
      setReturnInputs(returnInit);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [activeView, dateRange, todayStr, showToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (activeView === 'summary') {
      loadSummaryData();
    } else if (isMotorView) {
      setLoading(false);
    } else {
      loadUserData();
    }
  }, [activeView, isMotorView, loadSummaryData, loadUserData]);

  useEffect(() => {
    setIsEditingRemainder(false);
    setEditedRemainders({});
  }, [activeView]);

  const handleSelectView = (view) => {
    setActiveView(view);
    setSidebarOpen(false);
  };

  const flash = (msg) => {
    showToast(msg, 'success');
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

  const handleSummarySave = async (productId, fieldValues = {}) => {
    try {
      await api.saveSummary(todayStr, [
        {
          productId,
          warehouse: parseInput(
            fieldValues.warehouse !== undefined
              ? fieldValues.warehouse
              : warehouseInputs[productId]
          ),
          warehouseMotornaya: parseInput(
            fieldValues.warehouseMotornaya !== undefined
              ? fieldValues.warehouseMotornaya
              : motorInputs[productId]
          ),
        },
      ]);
    } catch (err) {
      showToast(err.message, 'error');
    }
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

  const handleExportSummary = async () => {
    setExportingSummary(true);

    try {
      const shopNames = shopUsers.map((user) => user.login);
      const data = globalProducts.map((product) => {
        const { total, warehouse, motor, afterShip, overall } = getRowCalcs(product.id);

        return {
          productName: product.name,
          shops: shopUsers.map((user) => getSummaryShipment(user.id, product.id)),
          total,
          warehouse,
          warehouseAfterShipment: afterShip,
          warehouseMotornaya: motor,
          totalRemain: overall,
        };
      });

      const blob = await api.exportSummary({
        date: todayStr,
        shopNames,
        data,
      });

      downloadBlob(blob, `Сводка_${todayLabel}.xlsx`);
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Не удалось экспортировать данные', 'error');
    } finally {
      setExportingSummary(false);
    }
  };

  const canSummaryActions =
    !loading && globalProducts.length > 0 && shopUsers.length > 0;

  const getCellData = (productId, dateStr) => {
    return stockMap[`${productId}-${dateStr}`] || null;
  };

  const getShipments = (productId, dateStr) => {
    return readShipmentTotal(productId, dateStr);
  };

  const getMovement = (productId, dateStr) => {
    const key = `${productId}-${dateStr}`;
    const cell = getCellData(productId, dateStr);
    if (movementInputs[key] !== undefined) {
      return parseInt(movementInputs[key], 10) || 0;
    }
    return parseInt(cell?.movement ?? 0, 10) || 0;
  };

  const getReturn = (productId, dateStr) => {
    const key = `${productId}-${dateStr}`;
    const cell = getCellData(productId, dateStr);
    if (returnInputs[key] !== undefined) {
      return parseInt(returnInputs[key], 10) || 0;
    }
    return parseInt(cell?.return ?? 0, 10) || 0;
  };

  const patchLocalStockField = (productId, dateStr, field, rawValue) => {
    const numericValue = parseInt(rawValue, 10) || 0;

    setStocks((prev) => {
      const idx = prev.findIndex(
        (item) =>
          Number(item.productId) === Number(productId) && item.date === dateStr
      );

      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], [field]: numericValue };
        return next;
      }

      return [
        ...prev,
        {
          productId,
          date: dateStr,
          quantity: null,
          shipments: field === 'shipments' ? numericValue : 0,
          movement: field === 'movement' ? numericValue : 0,
          return: field === 'return' ? numericValue : 0,
        },
      ];
    });
  };

  const handleTodayFieldChange = (productId, dateStr, field, value) => {
    if (dateStr !== todayStr) return;

    const key = `${productId}-${dateStr}`;
    const setters = {
      shipments: setShipmentInputs,
      movement: setMovementInputs,
      return: setReturnInputs,
    };

    setters[field]((prev) => ({
      ...prev,
      [key]: value,
    }));

    patchLocalStockField(productId, dateStr, field, value);
  };

  const mergeSavedStockRows = (savedRows) => {
    if (!savedRows?.length) return;

    setStocks((prev) => {
      const next = [...prev];

      for (const row of savedRows) {
        const idx = next.findIndex(
          (item) => item.productId === row.productId && item.date === row.date
        );
        const merged = {
          productId: row.productId,
          date: row.date,
          quantity: row.quantity,
          shipments: row.shipments ?? 0,
          movement: row.movement ?? 0,
          return: row.return ?? 0,
        };

        if (idx >= 0) {
          next[idx] = { ...next[idx], ...merged };
        } else {
          next.push(merged);
        }
      }

      return next;
    });
  };

  const handleTodayStockSave = async (productId) => {
    if (typeof activeView !== 'number') return;

    const key = `${productId}-${todayStr}`;

    try {
      const response = await api.saveStocks(activeView, todayStr, [
        {
          productId,
          shipments: parseInt(shipmentInputs[key], 10) || 0,
          movement: parseInt(movementInputs[key], 10) || 0,
          return: parseInt(returnInputs[key], 10) || 0,
        },
      ]);

      mergeSavedStockRows(response.saved);
      flash('Данные сохранены');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const getTodayQuantity = (productId) => {
    const cell = getCellData(productId, todayStr);
    return cell?.quantity ?? null;
  };

  const handleRemainderEditToggle = () => {
    if (isEditingRemainder) {
      handleSaveRemainders();
      return;
    }

    setEditedRemainders({});
    setIsEditingRemainder(true);
  };

  const handleSaveRemainders = async () => {
    if (typeof activeView !== 'number') return;

    const items = [];

    for (const product of userProducts) {
      const original = getTodayQuantity(product.id);
      const edited = editedRemainders[product.id];
      let quantity;

      if (edited === undefined || edited === '') {
        if (original === null || original === undefined) {
          continue;
        }
        quantity = parseInt(original, 10);
      } else {
        quantity = parseInt(edited, 10);
        if (isNaN(quantity) || quantity < 0) {
          showToast('Некорректное значение остатка', 'error');
          return;
        }
      }

      if (isNaN(quantity)) {
        continue;
      }

      items.push({ productId: product.id, quantity });
    }

    if (items.length === 0) {
      setIsEditingRemainder(false);
      setEditedRemainders({});
      return;
    }

    setSavingRemainders(true);
    try {
      const response = await api.updateStockQuantities(activeView, todayStr, items);
      mergeSavedStockRows(response.saved);
      setIsEditingRemainder(false);
      setEditedRemainders({});
      flash('Остатки сохранены');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingRemainders(false);
    }
  };

  const renderUserCell = (product, dateIndex) => {
    const dateStr = toISODate(dates[dateIndex]);
    const cell = getCellData(product.id, dateStr);
    const isToday = dateStr === todayStr;

    if (cell === null && !isToday) {
      return (
        <td key={product.id} className="stock-cell empty-cell">
          —
        </td>
      );
    }

    const quantity = cell?.quantity;
    const hasQuantity = quantity !== null && quantity !== undefined;

    let sales = null;
    if (cell !== null && dateIndex >= 2) {
      const nextDateStr = toISODate(dates[dateIndex - 1]);
      const nextQuantity = getCellData(product.id, nextDateStr)?.quantity ?? null;

      if (hasQuantity && nextQuantity !== null && nextQuantity !== undefined) {
        const currentShipments = getShipments(product.id, dateStr);
        const currentMovement = getMovement(product.id, dateStr);
        const currentReturn = getReturn(product.id, dateStr);
        sales =
          quantity +
          currentShipments -
          (nextQuantity + currentMovement + currentReturn);
      }
    }

    const shipmentKey = `${product.id}-${dateStr}`;
    const shipmentValue =
      shipmentInputs[shipmentKey] !== undefined
        ? shipmentInputs[shipmentKey]
        : cell?.shipments ?? '';
    const movementValue =
      movementInputs[shipmentKey] !== undefined
        ? movementInputs[shipmentKey]
        : cell?.movement ?? '';
    const returnValue =
      returnInputs[shipmentKey] !== undefined
        ? returnInputs[shipmentKey]
        : cell?.return ?? '';
    const pastShipments = cell?.shipments;
    const pastMovement = parseInt(cell?.movement ?? 0, 10) || 0;
    const pastReturn = parseInt(cell?.return ?? 0, 10) || 0;

    return (
      <td key={product.id} className="stock-cell">
        <div className="stock-cell-inner">
          <div className="stock-cell-row">
            {sales !== null ? (
              <span className={`stock-diff ${sales >= 0 ? 'positive' : 'negative'}`}>
                {sales}
              </span>
            ) : (
              <span className="stock-cell-placeholder">&nbsp;</span>
            )}
          </div>
          <div className="stock-cell-row">
            {isToday && isEditingRemainder ? (
              <input
                type="number"
                className="stock-qty-input"
                min="0"
                value={editedRemainders[product.id] ?? ''}
                placeholder={
                  hasQuantity ? String(quantity) : undefined
                }
                onChange={(e) =>
                  setEditedRemainders((prev) => ({
                    ...prev,
                    [product.id]: e.target.value,
                  }))
                }
              />
            ) : quantity !== null && quantity !== undefined ? (
              <span className="stock-qty">{quantity}</span>
            ) : (
              <span className="stock-cell-placeholder">&nbsp;</span>
            )}
          </div>
          <div className="stock-cell-row">
            {isToday ? (
              <input
                type="number"
                className="stock-shipment-input"
                min="0"
                value={shipmentValue}
                onChange={(e) =>
                  handleTodayFieldChange(product.id, dateStr, 'shipments', e.target.value)
                }
                onBlur={() => handleTodayStockSave(product.id)}
              />
            ) : pastShipments != null && pastShipments !== 0 ? (
              <span className="stock-shipment-readonly">{pastShipments}</span>
            ) : (
              <span className="stock-cell-placeholder">&nbsp;</span>
            )}
          </div>
          <div className="stock-cell-row">
            {isToday ? (
              <input
                type="number"
                className="stock-shipment-input stock-movement-input"
                min="0"
                value={movementValue}
                onChange={(e) =>
                  handleTodayFieldChange(product.id, dateStr, 'movement', e.target.value)
                }
                onBlur={() => handleTodayStockSave(product.id)}
              />
            ) : pastMovement !== 0 ? (
              <span className="stock-movement-readonly">{pastMovement}</span>
            ) : (
              <span className="stock-cell-placeholder">&nbsp;</span>
            )}
          </div>
          <div className="stock-cell-row">
            {isToday ? (
              <input
                type="number"
                className="stock-shipment-input stock-return-input"
                min="0"
                value={returnValue}
                onChange={(e) =>
                  handleTodayFieldChange(product.id, dateStr, 'return', e.target.value)
                }
                onBlur={() => handleTodayStockSave(product.id)}
              />
            ) : pastReturn !== 0 ? (
              <span className="stock-return-readonly">{pastReturn}</span>
            ) : (
              <span className="stock-cell-placeholder">&nbsp;</span>
            )}
          </div>
        </div>
      </td>
    );
  };

  const renderDateCell = (date) => {
    const dateStr = toISODate(date);
    const isToday = dateStr === todayStr;

    if (!isToday) {
      return <td className="date-col">{formatDateLabel(date)}</td>;
    }

    return (
      <td className="date-col date-col-with-legend">
        <div className="date-cell-inner">
          <div className="date-label">{formatDateLabel(date)}</div>
          <div className="date-legend">
            <span className="date-legend-item date-legend-sales">продажи</span>
            <span className="date-legend-item date-legend-qty">остаток</span>
            <span className="date-legend-item date-legend-field">отгрузка</span>
            <span className="date-legend-item date-legend-field date-legend-movement">перем</span>
            <span className="date-legend-item date-legend-field date-legend-return">возврат</span>
          </div>
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
      <div className="table-panel summary-table-panel">
        <div className="stock-scroll-container summary-scroll-container">
          <div className="products-table-wrapper summary-table-wrapper summary-pdf-target">
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
                          setWarehouseInputs((prev) => ({
                            ...prev,
                            [product.id]: e.target.value,
                          }))
                        }
                        onBlur={(e) =>
                          handleSummarySave(product.id, { warehouse: e.target.value })
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
                          setMotorInputs((prev) => ({
                            ...prev,
                            [product.id]: e.target.value,
                          }))
                        }
                        onBlur={(e) =>
                          handleSummarySave(product.id, { warehouseMotornaya: e.target.value })
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
            На магазине: <strong>{totalOnStore}</strong>
          </span>
          <span className="store-stat-divider" />
          <span>
            Отгрузка: <strong>{totalShipments}</strong>
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
              <span className="store-stat-divider" />
            </>
          )}
          <button
            type="button"
            className="btn-sm btn-update store-edit-remainder-btn"
            onClick={handleRemainderEditToggle}
            disabled={savingRemainders}
          >
            {isEditingRemainder ? 'сохранить' : 'изменить'}
          </button>
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
                    {renderDateCell(date)}
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
          {motorUser && (
            <div
              className={`user-item ${activeView === motorUser.id ? 'active' : ''}`}
              onClick={() => handleSelectView(motorUser.id)}
            >
              <span className="user-item-name">{motorUser.login} (Моторная)</span>
            </div>
          )}
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
              <div className="summary-toolbar-actions">
                <button
                  type="button"
                  className="btn-export"
                  onClick={handleExportSummary}
                  disabled={!canSummaryActions || exportingSummary}
                >
                  {exportingSummary ? 'Экспорт...' : 'Экспорт'}
                </button>
              </div>
            ) : null
          }
        />

        <div className="content-area admin-content-area">
          {loading ? (
            <div className="loading">Загрузка...</div>
          ) : activeView === 'summary' ? (
            renderSummaryView()
          ) : isMotorView ? (
            globalProducts.length === 0 ? (
              <div className="empty-state">Товаров пока нет</div>
            ) : (
              <SimplifiedMotorReport
                userId={motorUser.id}
                products={globalProducts}
                dates={dates}
              />
            )
          ) : (
            renderUserView()
          )}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
