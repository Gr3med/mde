// START OF FILE notifications.js

const nodemailer = require('nodemailer');
const pdf = require('html-pdf'); // استيراد مكتبة html-pdf
const config = require('./config.js');

// دالة لإنشاء ملف PDF من محتوى HTML
async function generatePdf(htmlContent) {
    return new Promise((resolve, reject) => {
        // خيارات PDF: حجم A4، اتجاه عمودي، هوامش 10 مم
        pdf.create(htmlContent, { format: 'A4', orientation: 'portrait', border: '10mm' }).toBuffer((err, buffer) => {
            if (err) {
                console.error('❌ Error generating PDF:', err);
                return reject(err);
            }
            resolve(buffer);
        });
    });
}

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
            html: htmlContent,
            attachments: attachments // هنا نضيف المرفقات
        };
        console.log(`📤 Sending email to: ${config.email.recipient}...`);
        await transporter.sendMail(mailOptions);
        console.log("✅ Email report sent successfully.");
    } catch (error) {
        console.error('❌ Error sending email report:', error);
        throw error;
    }
}

module.exports = { sendReportEmail, generatePdf }; // تصدير الدالتين
// END OF FILE notifications.js