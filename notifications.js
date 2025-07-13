// START OF FILE notifications.js

const nodemailer = require('nodemailer');
const config = require('./config.js');

// دالة لإرسال بريد إلكتروني، يمكن أن تحتوي على مرفقات
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
            html: htmlContent, // محتوى البريد الإلكتروني يمكن أن يكون HTML
            attachments: attachments // هنا نضيف المرفقات (الـ PDF buffer)
        };
        console.log(`📤 Sending email to: ${config.email.recipient}...`);
        await transporter.sendMail(mailOptions);
        console.log("✅ Email report sent successfully.");
    } catch (error) {
        console.error('❌ Error sending email report:', error);
        throw error;
    }
}

module.exports = { sendReportEmail }; // نصدر sendReportEmail فقط
// END OF FILE notifications.js
