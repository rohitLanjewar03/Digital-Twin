import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import NewsSearchPage from './pages/NewsSearchPage.jsx';
import BrowsingHistoryPage from './pages/BrowsingHistoryPage.jsx';
import Navigation from './components/Navigation.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import './App.css';

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={
          <>
            <Navigation />
            <div className="content-container">
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            </div>
          </>
        } />
        <Route path="/history" element={
          <>
            <Navigation />
            <div className="content-container">
              <ProtectedRoute>
                <BrowsingHistoryPage />
              </ProtectedRoute>
            </div>
          </>
        } />
        <Route path="/news-search" element={
          <>
            <Navigation />
            <div className="content-container">
              <ProtectedRoute>
                <NewsSearchPage />
              </ProtectedRoute>
            </div>
          </>
        } />
      </Routes>
    </div>
  );
}

export default App;
