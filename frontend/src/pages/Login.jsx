import React from 'react';

const Login = () => {
  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:5000/auth/google";
  };

  return (
    <div className="h-screen flex items-center justify-center">
      <button 
        className="bg-blue-500 text-white px-6 py-2 rounded-lg" 
        onClick={handleGoogleLogin}
      >
        Login with Google
      </button>
    </div>
  );
};

export default Login;
