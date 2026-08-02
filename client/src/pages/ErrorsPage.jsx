import { useState, useCallback } from 'react';
import AdminTopBar from '../components/AdminTopBar';
import { getErrors, clearErrors } from '../utils/errorLogger';
import './Dashboard.css';
import './AdminPages.css';
import './ErrorsPage.css';

function ErrorsPage() {
  const [errors, setErrors] = useState(() => getErrors());

  const reloadErrors = useCallback(() => {
    setErrors(getErrors());
  }, []);

  const handleClear = () => {
    clearErrors();
    setErrors([]);
  };

  return (
    <div className="page-layout">
      <AdminTopBar title="Ошибки" />

      <div className="content-area admin-content-area">
        <div className="errors-toolbar">
          <button type="button" className="btn-sm btn-update" onClick={reloadErrors}>
            Обновить
          </button>
          {errors.length > 0 && (
            <button type="button" className="btn-sm btn-delete" onClick={handleClear}>
              Очистить все
            </button>
          )}
        </div>

        {errors.length === 0 ? (
          <div className="empty-state">Ошибок нет</div>
        ) : (
          <div className="products-table-wrapper errors-table-wrapper">
            <table className="products-table errors-table">
              <thead>
                <tr>
                  <th className="errors-time-col">Время</th>
                  <th>Текст ошибки</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((error, index) => (
                  <tr key={`${error.time}-${index}`}>
                    <td className="errors-time-col">{error.time}</td>
                    <td>{error.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ErrorsPage;
