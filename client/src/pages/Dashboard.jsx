import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api';
import AdminTopBar from '../components/AdminTopBar';
import { getToday, formatDateFull, toISODate } from '../utils/dates';
import './Dashboard.css';
import './AdminPages.css';

function Dashboard() {
  const today = useMemo(() => getToday(), []);
  const todayStr = toISODate(today);
  const todayLabel = formatDateFull(today);

  const [shopUsers, setShopUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [shipmentMap, setShipmentMap] = useState({});
  const [warehouseInputs, setWarehouseInputs] = useState({});
  const [motorInputs, setMotorInputs] = useState({});
  const [warehouseCommitted, setWarehouseCommitted] = useState({});
  const [motorCommitted, setMotorCommitted] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, productsData, shipmentsData] = await Promise.all([
        api.getUsers(),
        api.getGlobalProducts(),
        api.getTodayShipments(todayStr),
      ]);

      const shops = usersData.filter((u) => u.role === 'user');
      setShopUsers(shops);
      setProducts(productsData);

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

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getShipment = (userId, globalProductId) => {
    return shipmentMap[`${userId}-${globalProductId}`] ?? 0;
  };

  const getRowTotal = (globalProductId) => {
    return shopUsers.reduce(
      (sum, user) => sum + getShipment(user.id, globalProductId),
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
    const warehouse = warehouseCommitted[globalProductId] ?? null;
    const motor = motorCommitted[globalProductId] ?? null;
    const afterShip = warehouse !== null ? warehouse - total : null;
    const overall =
      afterShip !== null && motor !== null ? afterShip + motor : null;

    return { total, afterShip, overall };
  };

  const commitWarehouse = (productId) => {
    setWarehouseCommitted((prev) => ({
      ...prev,
      [productId]: parseInput(warehouseInputs[productId]),
    }));
  };

  const commitMotor = (productId) => {
    setMotorCommitted((prev) => ({
      ...prev,
      [productId]: parseInput(motorInputs[productId]),
    }));
  };

  return (
    <div className="page-layout">
      <AdminTopBar title={todayLabel} />

      <div className="content-area admin-content-area">
        {error && (
          <div className="error-banner" onClick={() => setError('')}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading">Загрузка...</div>
        ) : products.length === 0 ? (
          <div className="empty-state">Товаров пока нет</div>
        ) : shopUsers.length === 0 ? (
          <div className="empty-state">Нет магазинов для отображения</div>
        ) : (
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
                  {products.map((product) => {
                    const { total, afterShip, overall } = getRowCalcs(product.id);

                    return (
                      <tr key={product.id}>
                        <td className="product-name-col">{product.name}</td>
                        {shopUsers.map((user) => (
                          <td key={user.id} className="summary-num">
                            {getShipment(user.id, product.id)}
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
                            onBlur={() => commitWarehouse(product.id)}
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
                            onBlur={() => commitMotor(product.id)}
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
        )}
      </div>
    </div>
  );
}

export default Dashboard;
