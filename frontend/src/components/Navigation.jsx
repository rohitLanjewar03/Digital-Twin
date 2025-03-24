import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import '../styles/Navigation.css';

const Navigation = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  
  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };
  
  return (
    <nav className="main-navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <Link to="/dashboard">Digital Twin</Link>
        </div>
        
        <div className="nav-links">
          <Link to="/dashboard" className={isActive('/dashboard')}>Dashboard</Link>
          <Link to="/history" className={isActive('/history')}>Browsing History</Link>
          <Link to="/news-search" className={isActive('/news-search')}>News Search</Link>
        </div>
        
        <div className="nav-user">
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