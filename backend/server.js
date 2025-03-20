require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
require('./config/googleAuth');

const authRoutes = require('./routes/authRoutes');
const emailRoutes = require('./routes/emailRoutes')

const app = express();
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

app.use(session({ 
    secret: 'your-secret-key', 
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));
app.use(passport.initialize());
app.use(passport.session());



mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log(err));

app.use('/auth', authRoutes);
app.use("/email",emailRoutes );


const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
