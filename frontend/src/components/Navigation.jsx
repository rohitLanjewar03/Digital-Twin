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
          <Link to="/dashboard">DIGI-U</Link>
        </div>
        
        <div className="nav-links">
          <Link to="/dashboard" className={isActive('/dashboard')}>Emails</Link>
          <Link to="/news-search" className={isActive('/news-search')}>News Search</Link>
          <Link to="/browsing-history" className={isActive('/browsing-history')}>Browsing History</Link>
        </div>
        
        <div className="nav-user">
          <button 
            className="theme-toggle-button" 
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          {user && (
            <>
              <span className="user-name">{user.email}</span>
              <button className="logout-button" onClick={logout}>Logout</button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;