const WEEKDAYS = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
];

export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getAdminStockDays() {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 15; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + 1 - i);
    dates.push(d);
  }

  return dates;
}

export function getLast15Days() {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 15; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d);
  }

  return dates;
}

export function formatDateLabel(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const weekday = WEEKDAYS[date.getDay()];
  return `${day}.${month} ${weekday}`;
}

export function isMonday(date) {
  return date.getDay() === 1;
}

export function formatDateFull(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

export function getToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getTomorrowISO() {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return toISODate(tomorrow);
}

export function buildStockMap(stocks) {
  const map = {};
  for (const s of stocks) {
    map[`${s.productId}-${s.date}`] = {
      quantity: s.quantity,
      shipments: s.shipments ?? 0,
      movement: s.movement ?? 0,
      return: s.return ?? 0,
    };
  }
  return map;
}

export function getSales(prevQty, prevShipments, currentQty) {
  if (prevQty === null || prevQty === undefined) return null;
  if (currentQty === null || currentQty === undefined) return null;
  return prevQty + (prevShipments ?? 0) - currentQty;
}

const MONTH_NAMES = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];

export function getReportMonths(count = 13) {
  const months = [];
  const now = new Date();
  now.setDate(1);
  now.setHours(0, 0, 0, 0);

  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      value,
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
    });
  }

  return months;
}

export function getMonthRange(monthValue) {
  const [yearStr, monthStr] = monthValue.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const lastDay = new Date(year, month, 0).getDate();
  const monthPadded = String(month).padStart(2, '0');

  return {
    startDate: `${year}-${monthPadded}-01`,
    endDate: `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function getDaysInMonth(monthValue) {
  const [yearStr, monthStr] = monthValue.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const daysCount = new Date(year, month, 0).getDate();
  const dates = [];

  for (let day = 1; day <= daysCount; day++) {
    dates.push(new Date(year, month - 1, day));
  }

  return dates;
}

export function formatDayMonth(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}`;
}

export function getMonthLabel(monthValue) {
  const [yearStr, monthStr] = monthValue.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  return `${MONTH_NAMES[month]} ${year}`;
}
