const STORAGE_KEY = 'app_errors';
const MAX_ERRORS = 50;

export function getErrors() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function logError(errorText) {
  const text = String(errorText || 'Неизвестная ошибка').trim();
  if (!text) return;

  const errors = getErrors();

  if (errors.length > 0 && errors[0].text === text) {
    return;
  }

  const newError = {
    time: new Date().toLocaleString('ru-RU', { hour12: false }),
    text,
  };

  errors.unshift(newError);

  if (errors.length > MAX_ERRORS) {
    errors.length = MAX_ERRORS;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(errors));
}

export function clearErrors() {
  localStorage.removeItem(STORAGE_KEY);
}
