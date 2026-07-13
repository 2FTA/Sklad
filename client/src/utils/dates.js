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
    };
  }
  return map;
}

export function getStockDiff(currentQty, prevQty) {
  if (currentQty === null || currentQty === undefined) return null;
  if (prevQty === null || prevQty === undefined) return null;
  return currentQty - prevQty;
}
