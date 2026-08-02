const ExcelJS = require('exceljs');

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

const MONTH_NAMES_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

function getInvoiceTitle(type) {
  if (type === 'return') {
    return 'ВНУТРІШНЯ НАКЛАДНА НА ПОВЕРНЕННЯ';
  }
  if (type === 'shipment') {
    return 'ВНУТРІШНЯ НАКЛАДНА НА ОТГРУЗКУ';
  }
  return 'ВНУТРІШНЯ НАКЛАДНА НА ПЕРЕМІЩЕННЯ';
}

function formatInvoiceDate(dateValue) {
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const day = d.getDate();
  const month =
    MONTH_NAMES_GENITIVE[d.getMonth()].charAt(0).toUpperCase() +
    MONTH_NAMES_GENITIVE[d.getMonth()].slice(1);
  const year = d.getFullYear();
  return `від ${day} ${month} ${year} г`;
}

function formatFileDate(dateValue) {
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

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
    const sum = item.sum ?? (item.quantity || 0) * (item.price || 0);
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

async function buildInvoiceWorkbook(invoice, items) {
  const title = getInvoiceTitle(invoice.type);
  const dateText = formatInvoiceDate(invoice.date);
  const totalSum =
    invoice.totalSum ??
    items.reduce((sum, item) => sum + (item.sum ?? (item.quantity || 0) * (item.price || 0)), 0);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Накладная');

  worksheet.getColumn(1).width = INVOICE_MARGIN_COL_WIDTH;
  INVOICE_SEPARATOR_COLS.forEach((col) => {
    worksheet.getColumn(col).width = INVOICE_SEPARATOR_COL_WIDTH;
  });

  fillInvoiceBlock(
    worksheet,
    INVOICE_LEFT_START_COL,
    title,
    dateText,
    invoice.fromName,
    invoice.toName,
    items,
    totalSum
  );
  fillInvoiceBlock(
    worksheet,
    INVOICE_RIGHT_START_COL,
    title,
    dateText,
    invoice.fromName,
    invoice.toName,
    items,
    totalSum
  );

  applyInvoicePrintSetup(worksheet, items.length);

  return workbook;
}

async function generateInvoiceExcelBuffer(invoice, items) {
  const workbook = await buildInvoiceWorkbook(invoice, items);
  return workbook.xlsx.writeBuffer();
}

function buildInvoiceFileName(dateValue) {
  return `Накладная_${formatFileDate(dateValue)}.xlsx`;
}

module.exports = {
  generateInvoiceExcelBuffer,
  buildInvoiceFileName,
  formatInvoiceDate,
};
