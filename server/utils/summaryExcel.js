const ExcelJS = require('exceljs');

const THIN_BLACK_BORDER = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

const HEADER_LABELS = [
  'Наименование',
  'Итого',
  'Склад',
  'Склад после отг',
  'Склад Моторная',
  'Общий остаток',
];

function normalizeCellValue(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  return value;
}

function buildRowValues(item, shopNames) {
  const shops = Array.isArray(item.shops)
    ? item.shops
    : shopNames.map((shopName) => item.shopValues?.[shopName] ?? 0);

  return [
    item.productName,
    ...shops.map((value) => normalizeCellValue(value)),
    normalizeCellValue(item.total),
    normalizeCellValue(item.warehouse),
    normalizeCellValue(item.warehouseAfterShipment),
    normalizeCellValue(item.warehouseMotornaya),
    normalizeCellValue(item.totalRemain),
  ];
}

function applyTableStyles(worksheet) {
  worksheet.eachRow((row, rowIndex) => {
    row.height = rowIndex === 1 ? 31.5 : 11;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = {
        name: 'Arial',
        size: 10,
        bold: false,
      };
      cell.alignment = {
        horizontal: colNumber === 1 ? 'left' : 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.border = THIN_BLACK_BORDER;
    });
  });
}

function applyColumnWidths(worksheet) {
  const columnCount = worksheet.columnCount || worksheet.getRow(1).cellCount;

  worksheet.getColumn(1).width = 20;

  for (let columnIndex = 2; columnIndex <= columnCount; columnIndex += 1) {
    worksheet.getColumn(columnIndex).width = 5.14;
  }
}

async function buildSummaryWorkbook({ shopNames = [], data = [] }) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Сводка');

  const headerRow = [
    HEADER_LABELS[0],
    ...shopNames,
    ...HEADER_LABELS.slice(1),
  ];

  worksheet.addRow(headerRow);

  data.forEach((item) => {
    worksheet.addRow(buildRowValues(item, shopNames));
  });

  applyTableStyles(worksheet);
  applyColumnWidths(worksheet);

  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
  };

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  buildSummaryWorkbook,
};
