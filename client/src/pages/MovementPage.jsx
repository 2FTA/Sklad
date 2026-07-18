import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { api } from '../api';
import AdminTopBar from '../components/AdminTopBar';
import { formatInvoiceDate, getToday, toISODate } from '../utils/dates';
import './Dashboard.css';
import './AdminPages.css';
import './MovementPage.css';

function toPositionKey(position) {
  return `${position.kind}-${position.id}`;
}

function parsePositionKey(key) {
  if (!key) return null;
  const dashIndex = key.indexOf('-');
  if (dashIndex === -1) return null;
  return {
    kind: key.slice(0, dashIndex),
    id: parseInt(key.slice(dashIndex + 1), 10),
  };
}

function AddPositionModal({ onClose, onAdd, loading, error }) {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd(name);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Добавить позицию</h3>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Название</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              Отмена
            </button>
            <button type="submit" className="btn-sm btn-update" disabled={loading}>
              {loading ? 'Добавление...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeletePositionModal({ positions, onClose, onDelete, loading, error }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Удалить позицию</h3>
        {positions.length === 0 ? (
          <p className="modal-text">Нет пользовательских позиций для удаления</p>
        ) : (
          <ul className="movement-delete-list">
            {positions.map((position) => (
              <li key={position.id} className="movement-delete-item">
                <span>{position.name}</span>
                <button
                  type="button"
                  className="btn-sm btn-delete"
                  onClick={() => onDelete(position.id)}
                  disabled={loading}
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

function MovementPage() {
  const [shopUsers, setShopUsers] = useState([]);
  const [customPositions, setCustomPositions] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [movementData, setMovementData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [movementType, setMovementType] = useState('');
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [positionActionLoading, setPositionActionLoading] = useState(false);
  const [positionActionError, setPositionActionError] = useState('');
  const tableRef = useRef(null);

  const allPositions = useMemo(
    () => [
      ...shopUsers.map((user) => ({ kind: 'user', id: user.id, name: user.login })),
      ...customPositions.map((position) => ({
        kind: 'custom',
        id: position.id,
        name: position.name,
      })),
    ],
    [shopUsers, customPositions]
  );

  const loadShops = useCallback(async () => {
    try {
      const users = await api.getUsers();
      setShopUsers(users.filter((user) => user.role === 'user'));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadCustomPositions = useCallback(async () => {
    try {
      const data = await api.getCustomPositions();
      setCustomPositions(data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    setShopsLoading(true);
    try {
      await Promise.all([loadShops(), loadCustomPositions()]);
    } finally {
      setShopsLoading(false);
    }
  }, [loadShops, loadCustomPositions]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    setFromUserId((prev) =>
      prev && allPositions.some((position) => toPositionKey(position) === prev) ? prev : ''
    );
    setToUserId((prev) =>
      prev && allPositions.some((position) => toPositionKey(position) === prev) ? prev : ''
    );
  }, [allPositions]);

  const allSelected = Boolean(movementType && fromUserId && toUserId);

  const getPositionName = useCallback(
    (key) => allPositions.find((position) => toPositionKey(position) === key)?.name || '—',
    [allPositions]
  );

  const loadMovementData = useCallback(async () => {
    if (!movementType || !fromUserId || !toUserId) {
      setMovementData([]);
      return;
    }

    const fromParsed = parsePositionKey(fromUserId);
    if (!fromParsed || fromParsed.kind !== 'user') {
      setMovementData([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await api.getMovementData(fromParsed.id, movementType);
      setMovementData(data);
    } catch (err) {
      setError(err.message);
      setMovementData([]);
    } finally {
      setLoading(false);
    }
  }, [movementType, fromUserId, toUserId]);

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
        loadInitialData();
        if (allSelected) {
          loadMovementData();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadInitialData, loadMovementData, allSelected]);

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

  const handleAddPosition = async (name) => {
    setPositionActionLoading(true);
    setPositionActionError('');

    try {
      const created = await api.createCustomPosition(name);
      setCustomPositions((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
      );
      setShowAddModal(false);
    } catch (err) {
      setPositionActionError(err.message);
    } finally {
      setPositionActionLoading(false);
    }
  };

  const handleDeletePosition = async (id) => {
    setPositionActionLoading(true);
    setPositionActionError('');

    try {
      await api.deleteCustomPosition(id);
      setCustomPositions((prev) => prev.filter((position) => position.id !== id));

      const deletedKey = `custom-${id}`;
      setFromUserId((prev) => (prev === deletedKey ? '' : prev));
      setToUserId((prev) => (prev === deletedKey ? '' : prev));
    } catch (err) {
      setPositionActionError(err.message);
    } finally {
      setPositionActionLoading(false);
    }
  };

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

          <div className="movement-filter movement-filter-with-actions">
            <label htmlFor="movement-from">От кого</label>
            <div className="movement-select-row">
              <select
                id="movement-from"
                className="movement-select"
                value={fromUserId}
                onChange={(e) => setFromUserId(e.target.value)}
                disabled={allPositions.length === 0}
              >
                <option value="">—</option>
                {allPositions.map((position) => (
                  <option key={toPositionKey(position)} value={toPositionKey(position)}>
                    {position.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-sm btn-update movement-position-btn"
                onClick={() => {
                  setPositionActionError('');
                  setShowAddModal(true);
                }}
              >
                Добавить
              </button>
              <button
                type="button"
                className="btn-sm btn-delete movement-position-btn"
                onClick={() => {
                  setPositionActionError('');
                  setShowDeleteModal(true);
                }}
              >
                Удалить
              </button>
            </div>
          </div>

          <div className="movement-filter">
            <label htmlFor="movement-to">Кому</label>
            <select
              id="movement-to"
              className="movement-select"
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              disabled={allPositions.length === 0}
            >
              <option value="">—</option>
              {allPositions.map((position) => (
                <option key={toPositionKey(position)} value={toPositionKey(position)}>
                  {position.name}
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
                  <strong>От кого:</strong> {getPositionName(fromUserId)}
                </span>
                <span>
                  <strong>Кому:</strong> {getPositionName(toUserId)}
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
                    {getPositionName(fromUserId)}
                  </span>
                  <span className="movement-summary">Підсумок: {totalSum}</span>
                </div>
                <div className="movement-signature-row">
                  <span className="movement-signature-line">
                    Одержав<span className="movement-signature-underline">__________</span>/{' '}
                    {getPositionName(toUserId)}
                  </span>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="empty-state">Выберите все параметры</div>
        )}
      </div>

      {showAddModal && (
        <AddPositionModal
          onClose={() => {
            setShowAddModal(false);
            setPositionActionError('');
          }}
          onAdd={handleAddPosition}
          loading={positionActionLoading}
          error={positionActionError}
        />
      )}

      {showDeleteModal && (
        <DeletePositionModal
          positions={customPositions}
          onClose={() => {
            setShowDeleteModal(false);
            setPositionActionError('');
          }}
          onDelete={handleDeletePosition}
          loading={positionActionLoading}
          error={positionActionError}
        />
      )}
    </div>
  );
}

export default MovementPage;
