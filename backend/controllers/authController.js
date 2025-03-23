const passport = require('passport');
const User = require('../models/User');

// Google OAuth2 Authentication
exports.googleAuth = passport.authenticate('google', {
    scope: [
        'profile', 
        'email', 
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/calendar'
    ]
});

// Google OAuth2 Callback
exports.googleAuthCallback = passport.authenticate('google', { failureRedirect: '/' });

exports.handleGoogleCallback = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
        req.session.user = {
            _id: req.user._id,
            googleId: req.user.googleId,
            name: req.user.name,
            email: req.user.email,
            accessToken: req.user.accessToken,
            refreshToken: req.user.refreshToken, 
            tokenExpiry: req.user.tokenExpiry, 
        };

        res.redirect('http://localhost:5173/dashboard');
    } catch (error) {
        console.error('Error handling Google callback:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Logout
exports.logout = (req, res) => {
    req.logout(() => {
        req.session.destroy((err) => {
            if (err) {
                console.error("Error destroying session:", err);
                return res.status(500).json({ error: 'Failed to logout' });
            }
            
            // Clear cookies
            res.clearCookie('connect.sid');
            
            // Send success response
            res.status(200).json({ message: 'Logged out successfully' });
        });
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

// Add this new function to the exports
exports.refreshSession = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const user = await User.findById(req.session.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Refresh the session with the latest user data
        req.session.user = {
            _id: user._id,
            googleId: user.googleId,
            name: user.name,
            email: user.email,
            accessToken: user.accessToken,
            refreshToken: user.refreshToken,
            tokenExpiry: user.tokenExpiry,
        };

        res.json({ message: "Session refreshed successfully" });
    } catch (error) {
        console.error("Error refreshing session:", error);
        res.status(500).json({ message: "Server Error" });
    }
};

// Add this function to the exports
exports.validateSession = async (req, res) => {
    try {
        // Check if the user session exists
        if (!req.session.user) {
            return res.status(401).json({ message: "No active session" });
        }

        // Try to find the user
        const user = await User.findById(req.session.user._id);
        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        // Check if token is expired
        if (user.tokenExpiry && user.tokenExpiry < Date.now()) {
            // Try to refresh the token
            try {
                const auth = new google.auth.OAuth2(
                    process.env.GOOGLE_CLIENT_ID,
                    process.env.GOOGLE_CLIENT_SECRET,
                    process.env.GOOGLE_REDIRECT_URI
                );
                
                auth.setCredentials({
                    refresh_token: user.refreshToken
                });
                
                const { tokens } = await auth.refreshAccessToken();
                
                // Update user tokens
                user.accessToken = tokens.access_token;
                user.tokenExpiry = tokens.expiry_date;
                await user.save();
                
                // Update session
                req.session.user = {
                    _id: user._id,
                    googleId: user.googleId,
                    name: user.name,
                    email: user.email,
                    accessToken: user.accessToken,
                    refreshToken: user.refreshToken,
                    tokenExpiry: user.tokenExpiry,
                };
                
                return res.status(200).json({ message: "Session validated and refreshed" });
            } catch (refreshError) {
                console.error("Error refreshing token:", refreshError);
                return res.status(401).json({ message: "Session expired and refresh failed" });
            }
        }

        // Session is valid
        return res.status(200).json({ message: "Session valid" });
    } catch (error) {
        console.error("Error validating session:", error);
        return res.status(500).json({ message: "Server error" });
    }
};