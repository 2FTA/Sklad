const ExcelJS = require('exceljs');

const THIN_BLACK_BORDER = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

const DEFAULT_FONT = { name: 'Arial', size: 10 };

function applyCellStyle(cell) {
  cell.border = THIN_BLACK_BORDER;
  cell.font = DEFAULT_FONT;
}

async function buildHouseholdWorkbook({ shopName, items = [] }) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Хозтовары');

  const shopCell = worksheet.getCell('A1');
  shopCell.value = shopName;
  applyCellStyle(shopCell);

  items.forEach((item, index) => {
    const rowNumber = index + 2;
    const nameCell = worksheet.getCell(`A${rowNumber}`);
    const qtyCell = worksheet.getCell(`B${rowNumber}`);

    nameCell.value = item.name;
    qtyCell.value = item.quantity;

    applyCellStyle(nameCell);
    applyCellStyle(qtyCell);
  });

  worksheet.getColumn(1).width = 40;
  worksheet.getColumn(2).width = 12;

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  buildHouseholdWorkbook,
};
