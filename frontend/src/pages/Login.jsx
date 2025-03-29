import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import LandingPage from '../assets/LandingPage.mp4'; // Import the video

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
    <div className="h-screen flex flex-col items-center justify-center bg-black relative">
    {/* Login Button (top-right) */}
    <button 
      className="absolute top-4 right-4 text-white px-4 py-2 border-2 border-gray-500 rounded-lg 
                hover:bg-blue-600 transition-colors z-10"
      onClick={handleGoogleLogin}
    >
      Login
    </button>
  
    {/* Video Container (centered with max-width/max-height) */}
    <div className="w-full max-w-7xl p-4"> {/* Adjust max-w as needed */}
      <video 
        src={LandingPage}
        autoPlay
        muted
        playsInline
        className="w-full h-auto rounded-2xl shadow-xl"
      />
    </div>
  </div>
  );
};

export default Login;
