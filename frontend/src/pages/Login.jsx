import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const Login = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    // If user is already authenticated, redirect to dashboard
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:5000/auth/google";
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-6">Email Assistant</h1>
        <button 
          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors" 
          onClick={handleGoogleLogin}
        >
          Login with Google
        </button>
      </div>
    </div>
  );
};

export default Login;
