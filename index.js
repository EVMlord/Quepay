import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();
import sendEmail from './utils/sendEmail.js';
import User from './models/user.js';

const PROJECT_NAME = 'Quepay';
const OTHER_COOL_INFO = '';

const app = express();

app.use(express.json()); // for parsing application/json

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error(err));

// API key verification middleware
const verifyApiKey = (req, res, next) => {
    const apiKey = req.get('X-API-Key'); // Or req.headers['x-api-key']
    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    next(); // If the API key is valid, continue
};

// Signup route
app.post('/signup', verifyApiKey, async (req, res) => {
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

        sendEmail({
            user: email,
            heading: 'Quepay Verification Code',
            text: `Your verification code is ${verificationCode}`
        }).then(result => {
            // console.log('Email sent successfully!');
            console.log(result)
            // console.log(message)
        }).catch(error => {
            console.error('Failed to send email:', error);
        });

        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Login route
app.post('/login', verifyApiKey, async (req, res) => {
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


app.post('/verify-email', verifyApiKey, async (req, res) => {
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

// app.post('/test', verifyApiKey, async (req, res) => {
//     try {
//         const { email } = req.body;
//         //const user = await User.findOne({ email: email });

//         try {
//             // Create a message for the email body
//             // const message = `You are receiving this email because you (or someone else)\n`;


//             sendEmail({
//                 user: email,
//                 heading: 'Quepay Verification Code',
//                 text: 'Hello World'
//             }).then(result => {
//                 // console.log('Email sent successfully!');
//                 console.log(result)
//                 // console.log(message)
//             }).catch(error => {
//                 console.error('Failed to send email:', error);
//             });
//         } catch (error) {
//             console.log(error)
//         }

//         res.json({ message: 'Email sent successfully' });
//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// });

app.post('/resend-verification', verifyApiKey, async (req, res) => {
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
                message: `Please wait ${Math.ceil(timeToWait / 60)} minutes before requesting a new verification code.`
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

            sendEmail({
                user: user.email,
                heading: 'Quepay Verification Code',
                text: `${message}`
            }).then(result => {
                console.log(result);
            }).catch(error => {
                console.error('Failed to send email:', error);
            });
        } catch (error) {
            console.log(error)
        }

        res.json({ message: 'A new verification code has been sent to your email address.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/', async (req, res) => {
    try {
        // Construct the statistics object
        const stats = {
            projectName: PROJECT_NAME,
            otherCoolInfo: OTHER_COOL_INFO,
            website: 'https://quepay.xyz'
            // You can add more statistics here
        };

        // Respond with the statistics
        res.json({ success: true, statistics: stats });
    } catch (error) {
        // If there's an error, respond with the error message
        res.status(500).json({ success: false, message: error.message });
    }
});




const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
