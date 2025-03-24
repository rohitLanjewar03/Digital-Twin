import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  // Show loading state while checking authentication
  if (loading) {
    return <div>Loading...</div>;
  }
  
  // If no user is found, redirect to login page
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // If user exists, render the protected component
  return children;
};

export default ProtectedRoute; 