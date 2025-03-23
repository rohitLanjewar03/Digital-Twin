const User = require('../models/User');

// Check if the user is authenticated
const isAuthenticated = async (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Unauthorized - Please log in" });
  }

  try {
    // Optionally check if the token is expired
    const user = await User.findById(req.session.user._id);
    
    if (!user) {
      req.session.destroy();
      return res.status(401).json({ message: "User not found" });
    }

    // Check if token is expired
    if (user.tokenExpiry && user.tokenExpiry < Date.now()) {
      // Token is expired - could implement refresh logic here
      // For now, just logout
      req.session.destroy();
      return res.status(401).json({ message: "Session expired - Please log in again" });
    }

    // Update req.session.user with fresh data
    req.session.user = {
      _id: user._id,
      googleId: user.googleId,
      name: user.name,
      email: user.email,
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
      tokenExpiry: user.tokenExpiry,
    };

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    return res.status(500).json({ message: "Server error during authentication check" });
  }
};

module.exports = { isAuthenticated }; 