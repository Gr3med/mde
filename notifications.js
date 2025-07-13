const nodemailer = require('nodemailer');
const config = require('./config.js');

async function sendTextReport(reportContent, totalReviews) {
    if (!config.email.enabled) {
        console.log("ℹ️ Email notifications are disabled.");
        return;
    }
    try {
        const transporter = nodemailer.createTransport(config.email.sender);
        const mailOptions = {
            from: `"تقارير الفندق" <${config.email.sender.auth.user}>`,
            to: config.email.recipient,
            subject: `📊 تقرير تقييمات تراكمي جديد (الإجمالي: ${totalReviews})`,
            html: reportContent
        };
        console.log(`📤 Sending email to: ${config.email.recipient}...`);
        await transporter.sendMail(mailOptions);
        console.log("✅ Email report sent successfully.");
    } catch (error) {
        console.error('❌ Error sending email report:', error);
        throw error;
    }
}

module.exports = { sendTextReport };