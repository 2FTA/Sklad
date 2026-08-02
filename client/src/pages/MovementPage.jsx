import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
// import html2canvas from 'html2canvas';
// import jsPDF from 'jspdf';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { api } from '../api';
import AdminTopBar from '../components/AdminTopBar';
import { useToast } from '../components/ToastContext';
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

const INVOICE_LEFT_START_COL = 2;
const INVOICE_RIGHT_START_COL = 10;
const INVOICE_SEPARATOR_COLS = [8, 9];
const INVOICE_BLOCK_WIDTH = 6;
const INVOICE_TABLE_HEADER_ROW = 5;
const INVOICE_QTY_HEADER_COL_OFFSET = 3;

const INVOICE_COLUMN_WIDTHS = [7, 21, 7, 6, 7, 10];
const INVOICE_SEPARATOR_COL_WIDTH = 2;
const INVOICE_MARGIN_COL_WIDTH = 2;

const INVOICE_THIN_BORDER = {
  top: { style: 'medium', color: { argb: 'FF000000' } },
  left: { style: 'medium', color: { argb: 'FF000000' } },
  bottom: { style: 'medium', color: { argb: 'FF000000' } },
  right: { style: 'medium', color: { argb: 'FF000000' } },
};

function fillInvoiceBlock(worksheet, startCol, title, dateText, fromName, toName, items, totalSum) {
  INVOICE_COLUMN_WIDTHS.forEach((width, index) => {
    worksheet.getColumn(startCol + index).width = width;
  });

  worksheet.mergeCells(1, startCol, 1, startCol + INVOICE_BLOCK_WIDTH - 1);
  const titleCell = worksheet.getCell(1, startCol);
  titleCell.value = title;
  titleCell.font = { bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.mergeCells(2, startCol, 2, startCol + INVOICE_BLOCK_WIDTH - 1);
  const dateCell = worksheet.getCell(2, startCol);
  dateCell.value = dateText;
  dateCell.font = { bold: true };
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' };

  const fromCell = worksheet.getCell(4, startCol);
  fromCell.value = `От кого: ${fromName}`;
  fromCell.font = { bold: true };

  const toCell = worksheet.getCell(4, startCol + 2);
  toCell.value = `Кому: ${toName}`;
  toCell.font = { bold: true };

  const headers = ['№ з/п', 'Найменування', 'Од. вим.', 'Кількість', 'Ціна', 'Сума'];
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(INVOICE_TABLE_HEADER_ROW, startCol + index);
    cell.value = header;
    cell.font = { bold: true };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: index === INVOICE_QTY_HEADER_COL_OFFSET,
    };
    cell.border = INVOICE_THIN_BORDER;
  });

  const dataStartRow = INVOICE_TABLE_HEADER_ROW + 1;
  items.forEach((item, index) => {
    const rowNum = dataStartRow + index;
    const sum = (item.quantity || 0) * (item.price || 0);
    const values = [
      index + 1,
      item.productName,
      item.unit || '—',
      item.quantity,
      item.price,
      sum,
    ];

    values.forEach((value, colIndex) => {
      const cell = worksheet.getCell(rowNum, startCol + colIndex);
      cell.value = value;
      cell.border = INVOICE_THIN_BORDER;
      if (colIndex >= 3) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colIndex === 0) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  const signatureRow = dataStartRow + items.length;
  const signatureCell = worksheet.getCell(signatureRow, startCol);
  signatureCell.value = `Відпустив__________/ ${fromName}`;
  signatureCell.font = { bold: true };
  signatureCell.alignment = { horizontal: 'left', vertical: 'middle' };

  const totalCell = worksheet.getCell(signatureRow, startCol + INVOICE_BLOCK_WIDTH - 1);
  totalCell.value = `Підсумок: ${totalSum}`;
  totalCell.font = { bold: true };
  totalCell.alignment = { horizontal: 'right', vertical: 'middle' };

  const receiverCell = worksheet.getCell(signatureRow + 1, startCol);
  receiverCell.value = `Одержав__________/ ${toName}`;
  receiverCell.font = { bold: true };
  receiverCell.alignment = { horizontal: 'left', vertical: 'middle' };
}

function applyInvoiceTableBorders(worksheet, startCol, itemCount) {
  const startRow = INVOICE_TABLE_HEADER_ROW;
  const endRow = itemCount > 0 ? INVOICE_TABLE_HEADER_ROW + itemCount : INVOICE_TABLE_HEADER_ROW;
  const endCol = startCol + INVOICE_BLOCK_WIDTH - 1;

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      worksheet.getCell(row, col).border = INVOICE_THIN_BORDER;
    }
  }
}

function applyInvoicePrintSetup(worksheet, itemCount) {
  const lastRow = INVOICE_TABLE_HEADER_ROW + itemCount + 2;

  worksheet.pageSetup.orientation = 'landscape';
  worksheet.pageSetup.paperSize = 9;
  worksheet.pageSetup.fitToPage = true;
  worksheet.pageSetup.fitToWidth = 1;
  worksheet.pageSetup.fitToHeight = 1;
  worksheet.pageSetup.printArea = `A1:O${lastRow}`;
  worksheet.pageSetup.margins = {
    left: 0.5,
    right: 0.5,
    top: 0.5,
    bottom: 0.5,
    header: 0,
    footer: 0,
  };

  worksheet.getRow(INVOICE_TABLE_HEADER_ROW).height = 32;

  applyInvoiceTableBorders(worksheet, INVOICE_LEFT_START_COL, itemCount);
  applyInvoiceTableBorders(worksheet, INVOICE_RIGHT_START_COL, itemCount);
}

function MovementPage() {
  const { showToast } = useToast();
  const [shopUsers, setShopUsers] = useState([]);
  const [customPositions, setCustomPositions] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [movementData, setMovementData] = useState([]);
  const [loading, setLoading] = useState(false);
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
      showToast(err.message, 'error');
    }
  }, []);

  const loadCustomPositions = useCallback(async () => {
    try {
      const data = await api.getCustomPositions();
      setCustomPositions(data);
    } catch (err) {
      showToast(err.message, 'error');
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

    const sourceKey = movementType === 'shipment' ? toUserId : fromUserId;
    const sourceParsed = parsePositionKey(sourceKey);

    if (!sourceParsed || sourceParsed.kind !== 'user') {
      setMovementData([]);
      return;
    }

    setLoading(true);

    try {
      const data = await api.getMovementData(sourceParsed.id, movementType);
      setMovementData(data);
    } catch (err) {
      showToast(err.message, 'error');
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
    if (movementType === 'shipment') {
      return 'ВНУТРІШНЯ НАКЛАДНА НА ОТГРУЗКУ';
    }
    return 'ВНУТРІШНЯ НАКЛАДНА НА ПЕРЕМІЩЕННЯ';
  }, [movementType]);

  const emptyMessage = useMemo(() => {
    if (movementType === 'return') return 'Повернень немає';
    if (movementType === 'shipment') return 'Отгрузок нет';
    return 'Перемещений нет';
  }, [movementType]);

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
    if (movementData.length === 0) return;

    setExporting(true);

    try {
      const todayDate = getToday();
      const fileName = `Накладная_${String(todayDate.getDate()).padStart(2, '0')}.${String(todayDate.getMonth() + 1).padStart(2, '0')}.${todayDate.getFullYear()}.xlsx`;
      const fromName = getPositionName(fromUserId);
      const toName = getPositionName(toUserId);
      const dateText = formatInvoiceDate(todayDate);

      const sourceKey = movementType === 'shipment' ? toUserId : fromUserId;
      const sourceParsed = parsePositionKey(sourceKey);

      if (sourceParsed?.kind !== 'user') {
        throw new Error('Накладная доступна только для магазинов');
      }

      const fromParsed = parsePositionKey(fromUserId);
      const fromShopId =
        movementType !== 'shipment' && fromParsed?.kind === 'user' ? fromParsed.id : null;

      await api.saveInvoice({
        shopId: sourceParsed.id,
        type: movementType,
        fromShopId,
        fromName,
        toName,
        items: movementData.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          unit: item.unit,
          quantity: item.quantity,
          price: item.price ?? 0,
          sum: (item.quantity || 0) * (item.price || 0),
        })),
      });

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Накладная');

      worksheet.getColumn(1).width = INVOICE_MARGIN_COL_WIDTH;
      INVOICE_SEPARATOR_COLS.forEach((col) => {
        worksheet.getColumn(col).width = INVOICE_SEPARATOR_COL_WIDTH;
      });

      fillInvoiceBlock(
        worksheet,
        INVOICE_LEFT_START_COL,
        invoiceTitle,
        dateText,
        fromName,
        toName,
        movementData,
        totalSum
      );
      fillInvoiceBlock(
        worksheet,
        INVOICE_RIGHT_START_COL,
        invoiceTitle,
        dateText,
        fromName,
        toName,
        movementData,
        totalSum
      );

      applyInvoicePrintSetup(worksheet, movementData.length);

      const buffer = await workbook.xlsx.writeBuffer();
      const fileBlob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      saveAs(fileBlob, fileName);
      showToast('Файл сохранён и доступен в отчетах', 'success');

      /*
      // PDF export (legacy)
      if (!tableRef.current) return;

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

      pdf.save(`Накладная_${today}.pdf`);
      */
    } catch (err) {
      showToast(err.message || 'Не удалось экспортировать Excel', 'error');
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
              <option value="shipment">Отгрузка</option>
            </select>
          </div>

          <div className="movement-filter">
            <label htmlFor="movement-from">От кого</label>
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

          <div className="movement-filter movement-filter-with-actions">
            <label aria-hidden="true">&nbsp;</label>
            <div className="movement-select-row">
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

          <button
            type="button"
            className="movement-export-btn"
            onClick={handleExport}
            disabled={!canExport || exporting}
          >
            {exporting ? 'Экспорт...' : 'Экспорт'}
          </button>
        </div>

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
