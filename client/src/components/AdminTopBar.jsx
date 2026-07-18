import { useNavigate, useLocation, Link } from 'react-router-dom';
import { clearAuth } from '../api';
import './AdminTopBar.css';

function AdminTopBar({ title, onMenuClick, leftExtra }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        {onMenuClick && (
          <button
            className="mobile-menu-btn"
            onClick={onMenuClick}
            aria-label="Меню"
          >
            ☰
          </button>
        )}
        {location.pathname !== '/' && (
          <Link to="/" className="back-link">
            ← Склад
          </Link>
        )}
        <h1>{title}</h1>
        {leftExtra}
      </div>
      <div className="top-bar-actions admin-nav">
        <Link
          to="/movement"
          className={`btn-nav ${location.pathname === '/movement' ? 'active' : ''}`}
        >
          Движение
        </Link>
        <Link
          to="/reports"
          className={`btn-nav ${location.pathname === '/reports' ? 'active' : ''}`}
        >
          Отчеты
        </Link>
        <Link
          to="/admin/users"
          className={`btn-nav ${location.pathname === '/admin/users' ? 'active' : ''}`}
        >
          Управление пользователями
        </Link>
        <Link
          to="/admin/products"
          className={`btn-nav ${location.pathname === '/admin/products' ? 'active' : ''}`}
        >
          Управление товарами
        </Link>
        <button className="btn-logout" onClick={handleLogout}>
          Выйти
        </button>
      </div>
    </div>
  );
}

export default AdminTopBar;
