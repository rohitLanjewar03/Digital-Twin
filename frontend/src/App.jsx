import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import NewsSearchPage from './pages/NewsSearchPage.jsx';
import BrowsingHistory from './pages/BrowsingHistory.jsx';
import BrowsingHistoryAnalytics from './pages/BrowsingHistoryAnalytics.jsx';
import Navigation from './components/Navigation.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { HistoryProvider } from './context/HistoryContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import LandingPage from './pages/LandingPage.jsx';
import './styles/theme.css';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <div className="app">
        <HistoryProvider>
          <Routes>
          <Route path="/" element={<LandingPage/>}/>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/browsing-history" element={
              <>
                <Navigation />
                <div className="content-container">
                  <BrowsingHistory />
                </div>
              </>
            } />
            <Route path="/browsing-history-analytics" element={
              <>
                <Navigation />
                <div className="content-container">
                  <BrowsingHistoryAnalytics />
                </div>
              </>
            } />
            <Route path="/view-history-by-email" element={<Navigate to="/browsing-history" />} />
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
        </HistoryProvider>
      </div>
    </ThemeProvider>
  );
}

export default App;
