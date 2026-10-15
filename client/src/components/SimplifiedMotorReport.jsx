import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatDateLabel, isMonday, toISODate } from '../utils/dates';

function SimplifiedMotorReport({ userId, products, dates }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const startDate = toISODate(dates[dates.length - 1]);
    const endDate = toISODate(dates[0]);

    setLoading(true);
    api
      .getMotorReport(userId, startDate, endDate)
      .then((rows) => {
        if (!cancelled) {
          setData(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId, dates]);

  const dataMap = {};
  data.forEach((row) => {
    dataMap[`${row.productId}-${row.date}`] = row.quantity;
  });

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  return (
    <div className="table-panel motor-report-wrapper">
      <div className="stock-scroll-container">
        <div className="products-table-wrapper stock-grid-wrapper">
          <table className="products-table stock-grid-table motor-report-table">
            <thead>
              <tr>
                <th className="date-col">Дата</th>
                {products.map((product) => (
                  <th key={product.id}>{product.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((date) => {
                const dateStr = toISODate(date);
                return (
                  <tr key={dateStr} className={isMonday(date) ? 'monday-row' : ''}>
                    <td className="date-col">{formatDateLabel(date)}</td>
                    {products.map((product) => {
                      const value = dataMap[`${product.id}-${dateStr}`];
                      return (
                        <td key={product.id} className="stock-cell motor-report-cell text-center">
                          {value != null && value !== '' ? value : '—'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default SimplifiedMotorReport;
