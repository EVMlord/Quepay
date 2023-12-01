import dotenv from 'dotenv';
dotenv.config();
import nodemailer from 'nodemailer';

// Email server configuration with SSL/TLS
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT, // Make sure to use the correct port for SSL or TLS
    secure: true, // Use this for SSL
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    },
    // dkim: {
    //     domainName: 'quepay.xyz',
    //     keySelector: 'default',
    //     privateKey: process.env.DKIM_KEY,
    // },
});

const sendEmail = async ({ user, heading, text }) => {
    try {
        const result = await transporter.sendMail({
            from: `"Quepay Inc." <${process.env.EMAIL_USER}>`,
            to: user,
            subject: heading,
            text: text
        });

        console.log('Message sent: %s', result.messageId);
        return result;
    } catch (error) {
        console.error('Error sending email: ', error);
        throw error;
    }
};

export default sendEmail;