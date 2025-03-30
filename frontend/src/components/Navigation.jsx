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
    <nav className="main-navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <Link to="/dashboard">
            <span className="brand-icon">📧</span>
            <span className="brand-text">DIGI-U</span>
          </Link>
        </div>
        
        <div className="nav-links">
          <Link to="/dashboard" className={isActive('/dashboard')}>
            <span className="nav-link-icon">📥</span> Emails
          </Link>
          <Link to="/news-search" className={isActive('/news-search')}>
            <span className="nav-link-icon">📰</span> News Search
          </Link>
          <Link to="/browsing-history" className={isActive('/browsing-history')}>
            <span className="nav-link-icon">🔍</span> Browsing History
          </Link>
        </div>
        
        <div className="nav-user">
          <button 
            className="theme-toggle-button" 
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            <span className="theme-icon">{theme === 'light' ? '🌙' : '☀️'}</span>
            <span className="theme-text">{theme === 'light' ? 'Dark' : 'Light'} Mode</span>
          </button>
          {user && (
            <>
              <div className="user-profile">
                <span className="user-avatar">{user.email.charAt(0).toUpperCase()}</span>
                <span className="user-name">{user.email}</span>
              </div>
              <button className="logout-button" onClick={logout}>
                <span className="logout-icon">🚪</span>
                <span>Logout</span>
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;