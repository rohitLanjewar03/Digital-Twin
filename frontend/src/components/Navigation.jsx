import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/ThemeContext';
import '../styles/Navigation.css';

const Navigation = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };
  
  return (
    <nav className="navbar modern-navbar">
      <div className="navbar-logo-area">
        <span className="navbar-logo-modern">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginRight: '8px'}}>
            <circle cx="16" cy="16" r="16" fill="#4285f4"/>
            <text x="16" y="21" textAnchor="middle" fontSize="14" fill="#fff" fontWeight="bold" fontFamily="Segoe UI, sans-serif">DT</text>
          </svg>
          <span className="brand-name">DIGI TWIN</span>
        </span>
      </div>
      <div className="navbar-links">
        <Link to="/" className={isActive('/')}>
          <span className="nav-link-icon">📥</span> Emails
        </Link>
        <Link to="/news-search" className={isActive('/news-search')}>
          <span className="nav-link-icon">📰</span> News Search
        </Link>
        <Link to="/browsing-history" className={isActive('/browsing-history')}>
          <span className="nav-link-icon">🔍</span> Browsing History
        </Link>
      </div>
      <div className="navbar-actions">
        <button className="theme-toggle-modern" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? <span role="img" aria-label="Light Mode">🌞</span> : <span role="img" aria-label="Dark Mode">🌙</span>}
        </button>
        {user?.email && (
          <span className="user-avatar-modern" title={user.email}>{user.email[0].toUpperCase()}</span>
        )}
        <button className="logout-icon-btn" onClick={logout} title="Logout">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </nav>
  );
};

export default Navigation;