const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const sendEmail = require('./utils/sendEmail');

const app = express();

app.use(express.json()); // for parsing application/json

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error(err));

const User = require('./models/user');

// API key verification middleware
const verifyApiKey = (req, res, next) => {
    const apiKey = req.get('X-API-Key'); // Or req.headers['x-api-key']
    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    next(); // If the API key is valid, continue
};

// Signup route
app.post('/signup', async (req, res) => {
    try {
        // Check if user already exists
        let user = await User.findOne({ email: req.body.email });
        if (user) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        // Create a new user
        user = new User(req.body);
        const verificationCode = Math.floor(100000 + Math.random() * 900000); // 6 digits code
        user.emailVerificationCode = verificationCode.toString(); // Convert number to string
        user.emailVerificationExpires = new Date(Date.now() + 3600000); // 1 hour from now
        await user.save();

        try {

            // sendVerificationEmail(user, verificationCode); // send the numeric code in the email
        } catch (error) {
            console.log(error)
        }


        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Login route
app.post('/login', async (req, res) => {
    try {
        // Check if user exists
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            return res.status(401).json({ message: 'User does not exist!' });
        }

        // Check if password matches
        const isMatch = await user.comparePassword(req.body.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Incorrect Password!' });
        }

        // User matched, create JWT Payload
        const payload = { id: user.id, username: user.username };
        // Sign token (expires in 1 hour)
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ message: 'Logged in successfully', token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


app.post('/verify-email', async (req, res) => {
    try {
        const { email, code } = req.body;
        const user = await User.findOne({ email: email });

        // Ensure both codes are strings before comparison
        if (!user || user.emailVerificationCode !== code.toString() || new Date() > user.emailVerificationExpires) {
            return res.status(400).json({ message: 'Invalid or expired verification code' });
        }

        user.emailVerified = true;
        user.emailVerificationCode = undefined; // Clear the code
        user.emailVerificationExpires = undefined; // Clear the expiration
        await user.save();

        res.json({ message: 'Email verified successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email: email });

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (user.emailVerified) {
            return res.status(400).json({ message: 'This account has already been verified.' });
        }

        const now = new Date();

        // Check if the verification code is still valid
        if (user.emailVerificationExpires && user.emailVerificationExpires > now) {
            // Calculate time remaining until the user can request a new code
            const timeToWait = (user.emailVerificationExpires - now) / 1000; // Convert to seconds
            return res.status(429).json({
                message: `Please wait ${Math.ceil(timeToWait)} seconds before requesting a new verification code.`
            });
        }

        // Generate a new verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000); // 6 digit code
        user.emailVerificationCode = verificationCode.toString();
        user.emailVerificationExpires = new Date(now.getTime() + 3600000); // 1 hour from now

        await user.save();

        try {
            // Create a message for the email body
            const message = `You are receiving this email because you (or someone else) have requested another verification code for your account.\n\n
  Please copy the following code, and paste it into your application to complete the verification process within one hour of receiving it:\n\n
  ${verificationCode}\n\n
  If you did not request this, please ignore this email and your account will remain unverified.\n`;


            await sendEmail({
                to: user.email,
                subject: 'Quepay Verification Code',
                text: message,
            });
            //sendVerificationEmail(user, verificationCode); // send the numeric code in the email
        } catch (error) {
            console.log(error)
        }

        res.json({ message: 'A new verification code has been sent to your email address.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});




const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
