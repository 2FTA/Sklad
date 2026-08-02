import { useEffect } from 'react';
import { logError } from '../utils/errorLogger';

function GlobalErrorHandlers() {
  useEffect(() => {
    const handleUnhandledRejection = (event) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : 'Неизвестная ошибка';

      logError(message || 'Неизвестная ошибка');
    };

    const handleError = (event) => {
      logError(event.message || 'Неизвестная ошибка');
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return null;
}

export default GlobalErrorHandlers;
