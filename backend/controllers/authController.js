const passport = require('passport');
const User = require('../models/User');

// Google OAuth2 Authentication
exports.googleAuth = passport.authenticate('google', {
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/calendar']
});

// Google OAuth2 Callback
exports.googleAuthCallback = passport.authenticate('google', { failureRedirect: '/' });

// Handle Google Callback
exports.handleGoogleCallback = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
        // Save user in session
        req.session.user = req.user;
        res.redirect('http://localhost:5173/dashboard');
    } catch (error) {
        console.error('Error handling Google callback:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Logout
exports.logout = (req, res) => {
    req.logout(() => {
        req.session.destroy(); // Destroy the session
        res.send('Logged out');
    });
};

// Get User Profile
exports.getUserProfile = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const user = await User.findById(req.session.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(user); // Send user data as JSON response
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Server Error" });
    }
};