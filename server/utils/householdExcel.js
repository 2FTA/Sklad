const ExcelJS = require('exceljs');

const THIN_BLACK_BORDER = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

const DEFAULT_FONT = { name: 'Arial', size: 10 };

function styleDataCell(cell) {
  cell.border = THIN_BLACK_BORDER;
  cell.font = DEFAULT_FONT;
}

function styleHeaderCell(cell) {
  cell.border = THIN_BLACK_BORDER;
  cell.font = { ...DEFAULT_FONT, bold: true };
}

async function buildHouseholdWorkbook({ shops = [] }) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Хозтовары');

  shops.forEach((shop, index) => {
    const startCol = 1 + index * 2;

    const headerCell = worksheet.getCell(1, startCol);
    headerCell.value = shop.shopName;
    styleHeaderCell(headerCell);

    shop.items.forEach((item, rowIndex) => {
      const row = rowIndex + 2;
      const nameCell = worksheet.getCell(row, startCol);
      const qtyCell = worksheet.getCell(row, startCol + 1);

      nameCell.value = item.name;
      qtyCell.value = item.quantity;

      styleDataCell(nameCell);
      styleDataCell(qtyCell);
    });

    worksheet.getColumn(startCol).width = 40;
    worksheet.getColumn(startCol + 1).width = 12;
  });

  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  buildHouseholdWorkbook,
};
