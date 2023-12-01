require('dotenv').config();
const emailjs = require('emailjs');

// Email server configuration with SSL/TLS
const server = emailjs.server.connect({
    host: process.env.EMAIL_HOST,
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    ssl: true, // Use this for SSL
    // tls: true, // Uncomment and use this instead of ssl if the server requires STARTTLS
    port: process.env.EMAIL_PORT, // Make sure to use the correct port for SSL or TLS
});

const sendEmail = ({ to, subject, text }) => {
    return new Promise((resolve, reject) => {
        server.send({
            from: process.env.EMAIL_USER,
            to,
            subject,
            text,
        }, (err, message) => {
            if (err) {
                reject(err);
            } else {
                resolve(message);
            }
        });
    });
};

module.exports = sendEmail;