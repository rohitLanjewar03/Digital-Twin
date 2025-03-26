require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
require('./config/googleAuth');

const authRoutes = require('./routes/authRoutes');
const emailRoutes = require('./routes/emailRoutes');
const agentRoutes = require('./routes/agentRoutes');
const newsRoutes = require('./routes/newsRoutes');
const historyRoutes = require('./routes/historyRoutes');

const app = express();

// Configure CORS to allow requests from frontend and Chrome extension
app.use(cors({ 
    origin: [
        "http://localhost:5173",
        /^chrome-extension:\/\/.+$/  // Allow all Chrome extensions
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use(session({ 
    secret: process.env.SESSION_SECRET || 'your-secret-key', 
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        sameSite: 'lax' // Help with cross-site requests
    }
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log(err));

app.use('/auth', authRoutes);
app.use('/email', emailRoutes);
app.use('/agent', agentRoutes);
app.use('/news', newsRoutes);
app.use('/history', historyRoutes);

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
