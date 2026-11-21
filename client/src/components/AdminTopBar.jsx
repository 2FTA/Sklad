import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { clearAuth } from '../api';
import { useExpired } from './ExpiredContext';
import './AdminTopBar.css';

const NAV_LINKS = [
  { to: '/', label: 'Склад' },
  { to: '/admin/household', label: 'Хоз товары' },
  { to: '/expired', label: 'Просрочка' },
  { to: '/movement', label: 'Движение' },
  { to: '/reports', label: 'Отчеты' },
  { to: '/admin/users', label: 'Управление пользователями' },
  { to: '/admin/products', label: 'Управление товарами' },
  { to: '/errors', label: 'Ошибки' },
];

function AdminTopBar({ title, onMenuClick, leftExtra }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { shouldBlink } = useExpired();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setIsMenuOpen(true)}
          aria-label="Меню"
        >
          ☰
        </button>
        {onMenuClick && (
          <button
            type="button"
            className="mobile-shops-btn"
            onClick={onMenuClick}
            aria-label="Магазины"
          >
            Магазины
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
          to="/admin/household"
          className={`btn-nav ${location.pathname === '/admin/household' ? 'active' : ''}`}
        >
          Хоз товары
        </Link>
        <Link
          to="/expired"
          className={`btn-nav ${location.pathname === '/expired' ? 'active' : ''} ${
            shouldBlink ? 'btn-nav-blink' : ''
          }`}
        >
          Просрочка
        </Link>
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
        <Link
          to="/errors"
          className={`btn-nav ${location.pathname === '/errors' ? 'active' : ''}`}
        >
          Ошибки
        </Link>
        <button className="btn-logout" onClick={handleLogout}>
          Выйти
        </button>
      </div>

      <div
        className={`admin-mobile-nav-overlay ${isMenuOpen ? 'open' : ''}`}
        onClick={closeMenu}
        aria-hidden={!isMenuOpen}
      />
      <aside className={`admin-mobile-nav ${isMenuOpen ? 'open' : ''}`} aria-hidden={!isMenuOpen}>
        <div className="admin-mobile-nav-header">
          <span>Меню</span>
          <button
            type="button"
            className="admin-mobile-nav-close"
            onClick={closeMenu}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        <nav className="admin-mobile-nav-list">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`admin-mobile-nav-item ${
                location.pathname === link.to ? 'active' : ''
              } ${link.to === '/expired' && shouldBlink ? 'btn-nav-blink' : ''}`}
              onClick={closeMenu}
            >
              {link.label}
            </Link>
          ))}
          <button type="button" className="admin-mobile-nav-item logout" onClick={handleLogout}>
            Выйти
          </button>
        </nav>
      </aside>
    </div>
  );
}

export default AdminTopBar;
