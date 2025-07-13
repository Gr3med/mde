// START OF FILE notifications.js (تأكد أن هذا هو المحتوى في ملفك)

const nodemailer = require('nodemailer');
const config = require('./config.js');

async function sendReportEmail(subject, htmlContent, attachments = []) {
    if (!config.email.enabled) {
        console.log("ℹ️ Email notifications are disabled.");
        return;
    }
    try {
        const transporter = nodemailer.createTransport(config.email.sender);
        const mailOptions = {
            from: `"تقارير الفندق" <${config.email.sender.auth.user}>`,
            to: config.email.recipient,
            subject: subject,
            html: htmlContent,
            attachments: attachments
        };
        console.log(`📤 Sending email to: ${config.email.recipient}...`);
        await transporter.sendMail(mailOptions);
        console.log("✅ Email report sent successfully.");
    } catch (error) {
        console.error('❌ Error sending email report:', error);
        throw error;
    }
}

module.exports = { sendReportEmail };
// END OF FILE notifications.js
