import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { api } from '../api';
import AdminTopBar from '../components/AdminTopBar';
import { formatInvoiceDate, getToday, toISODate } from '../utils/dates';
import './Dashboard.css';
import './AdminPages.css';
import './MovementPage.css';

function MovementPage() {
  const [shopUsers, setShopUsers] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [movementData, setMovementData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [movementType, setMovementType] = useState('');
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [exporting, setExporting] = useState(false);
  const tableRef = useRef(null);

  const loadShops = useCallback(async () => {
    try {
      const users = await api.getUsers();
      const shops = users.filter((u) => u.role === 'user');
      setShopUsers(shops);

      setFromUserId((prev) =>
        prev && shops.some((u) => String(u.id) === prev) ? prev : ''
      );
      setToUserId((prev) =>
        prev && shops.some((u) => String(u.id) === prev) ? prev : ''
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setShopsLoading(false);
    }
  }, []);

  const allSelected = Boolean(movementType && fromUserId && toUserId);

  const loadMovementData = useCallback(async () => {
    if (!movementType || !fromUserId || !toUserId) {
      setMovementData([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await api.getMovementData(Number(fromUserId), movementType);
      setMovementData(data);
    } catch (err) {
      setError(err.message);
      setMovementData([]);
    } finally {
      setLoading(false);
    }
  }, [movementType, fromUserId, toUserId]);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  useEffect(() => {
    if (allSelected) {
      loadMovementData();
    } else {
      setMovementData([]);
    }
  }, [allSelected, movementType, fromUserId, toUserId, loadMovementData]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadShops();
        if (allSelected) {
          loadMovementData();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadShops, loadMovementData, allSelected]);

  const fromUser = shopUsers.find((u) => String(u.id) === fromUserId);
  const toUser = shopUsers.find((u) => String(u.id) === toUserId);

  const invoiceTitle = useMemo(() => {
    if (movementType === 'return') {
      return 'ВНУТРІШНЯ НАКЛАДНА НА ПОВЕРНЕННЯ';
    }
    return 'ВНУТРІШНЯ НАКЛАДНА НА ПЕРЕМІЩЕННЯ';
  }, [movementType]);

  const emptyMessage =
    movementType === 'return' ? 'Повернень немає' : 'Перемещений нет';

  const totalSum = movementData.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.price || 0),
    0
  );

  const canExport = allSelected && !loading && movementData.length > 0 && !shopsLoading;

  const handleExport = async () => {
    if (!tableRef.current) return;

    setExporting(true);
    setError('');

    try {
      const canvas = await html2canvas(tableRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const leftMargin = 5;
      const topMargin = 5;
      const gap = 5;
      const halfWidth = (pageWidth - leftMargin * 2 - gap) / 2;
      const maxHeight = pageHeight - topMargin * 2;

      const aspectRatio = canvas.width / canvas.height;
      let scaledWidth = halfWidth;
      let scaledHeight = scaledWidth / aspectRatio;

      if (scaledHeight > maxHeight) {
        scaledHeight = maxHeight;
        scaledWidth = scaledHeight * aspectRatio;
      }

      pdf.addImage(imgData, 'PNG', leftMargin, topMargin, scaledWidth, scaledHeight);
      pdf.addImage(
        imgData,
        'PNG',
        leftMargin + halfWidth + gap,
        topMargin,
        scaledWidth,
        scaledHeight
      );

      pdf.save(`Накладная_${toISODate(getToday())}.pdf`);
    } catch (err) {
      setError(err.message || 'Не удалось экспортировать PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page-layout">
      <AdminTopBar title="Движение" />

      <div className="content-area admin-content-area">
        <div className="movement-toolbar">
          <div className="movement-filter">
            <label htmlFor="movement-type">Действие</label>
            <select
              id="movement-type"
              className="movement-select"
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
            >
              <option value="">—</option>
              <option value="movement">Перемещение</option>
              <option value="return">Возврат</option>
            </select>
          </div>

          <div className="movement-filter">
            <label htmlFor="movement-from">От кого</label>
            <select
              id="movement-from"
              className="movement-select"
              value={fromUserId}
              onChange={(e) => setFromUserId(e.target.value)}
              disabled={shopUsers.length === 0}
            >
              <option value="">—</option>
              {shopUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.login}
                </option>
              ))}
            </select>
          </div>

          <div className="movement-filter">
            <label htmlFor="movement-to">Кому</label>
            <select
              id="movement-to"
              className="movement-select"
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              disabled={shopUsers.length === 0}
            >
              <option value="">—</option>
              {shopUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.login}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="movement-export-btn"
            onClick={handleExport}
            disabled={!canExport || exporting}
          >
            {exporting ? 'Экспорт...' : 'Экспорт'}
          </button>
        </div>

        {error && (
          <div className="error-banner" onClick={() => setError('')}>
            {error}
          </div>
        )}

        {shopsLoading ? (
          <div className="loading">Загрузка...</div>
        ) : allSelected ? (
          loading ? (
            <div className="loading">Загрузка...</div>
          ) : movementData.length === 0 ? (
            <div className="empty-state">{emptyMessage}</div>
          ) : (
            <div className="movement-invoice" ref={tableRef}>
              <h2 className="movement-invoice-title">{invoiceTitle}</h2>
              <p className="movement-invoice-date">{formatInvoiceDate(getToday())}</p>

              <div className="movement-invoice-parties">
                <span>
                  <strong>От кого:</strong> {fromUser?.login || '—'}
                </span>
                <span>
                  <strong>Кому:</strong> {toUser?.login || '—'}
                </span>
              </div>

              <div className="movement-invoice-table-wrapper">
                <table className="movement-invoice-table">
                  <thead>
                    <tr>
                      <th>№ з/п</th>
                      <th>Найменування</th>
                      <th>Од. вим.</th>
                      <th>Кількість</th>
                      <th>Ціна</th>
                      <th>Сума</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementData.map((item, index) => {
                      const sum = (item.quantity || 0) * (item.price || 0);
                      return (
                        <tr key={`${item.productName}-${index}`}>
                          <td className="movement-num">{index + 1}</td>
                          <td className="movement-name">{item.productName}</td>
                          <td>{item.unit || '—'}</td>
                          <td className="movement-num">{item.quantity}</td>
                          <td className="movement-num">{item.price}</td>
                          <td className="movement-num">{sum}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="movement-invoice-signatures">
                <div className="movement-signature-row movement-signature-row-total">
                  <span className="movement-signature-line">
                    Відпустив<span className="movement-signature-underline">__________</span>/{' '}
                    {fromUser?.login || '—'}
                  </span>
                  <span className="movement-summary">Підсумок: {totalSum}</span>
                </div>
                <div className="movement-signature-row">
                  <span className="movement-signature-line">
                    Одержав<span className="movement-signature-underline">__________</span>/{' '}
                    {toUser?.login || '—'}
                  </span>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="empty-state">Выберите все параметры</div>
        )}
      </div>
    </div>
  );
}

export default MovementPage;
