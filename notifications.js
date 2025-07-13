// START OF FILE notifications.js

const nodemailer = require('nodemailer');
// --- 1. استيراد المكتبات الجديدة ---
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
// ------------------------------------
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

async function sendReportEmail(subject, htmlBody, attachments) {
    const mailOptions = {
        from: `"تقارير فندق ماريوت" <${process.env.EMAIL_USER}>`,
        to: process.env.RECIPIENT_EMAIL,
        subject: subject,
        html: htmlBody,
        attachments: attachments,
    };
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email report sent successfully:', info.response);
    } catch (error) {
        console.error('❌ Error sending email report:', error);
    }
}

/**
 * ينشئ ملف PDF احترافي من بيانات التقييمات.
 * (مُعدَّل للعمل على منصة Render)
 * @param {object} stats - إحصائيات عامة.
 * @param {Array} recentReviews - مصفوفة بآخر التقييمات.
 * @returns {Buffer} - محتوى ملف PDF كـ Buffer.
 */
async function generatePdf(stats, recentReviews) {
    const today = new Date();
    // تصميم HTML لا يتغير
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
            <style>
                :root { --primary-color: #003c71; --secondary-color: #d4a75c; --text-color: #333; --light-gray: #f8f9fa; --border-color: #dee2e6; }
                body { font-family: 'Tajawal', sans-serif; margin: 0; padding: 0; background-color: #fff; color: var(--text-color); -webkit-print-color-adjust: exact; }
                .page { padding: 40px; background: white; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid var(--primary-color); padding-bottom: 20px; }
                .header-logo { font-size: 28px; font-weight: 700; color: var(--primary-color); }
                .header-info { text-align: left; }
                .header-info h1 { margin: 0; font-size: 24px; color: var(--primary-color); }
                .header-info p { margin: 5px 0 0; color: #6c757d; }
                .section-title { font-size: 22px; font-weight: 700; color: var(--primary-color); border-bottom: 2px solid var(--secondary-color); padding-bottom: 10px; margin-top: 40px; margin-bottom: 20px; }
                .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
                .summary-card { background-color: var(--light-gray); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; text-align: center; }
                .summary-card h3 { margin: 0 0 15px 0; font-size: 18px; color: var(--primary-color); font-weight: 500; }
                .summary-card .score { font-size: 40px; font-weight: 700; color: var(--secondary-color); }
                .summary-card .score small { font-size: 20px; color: #6c757d; }
                .progress-bar-container { width: 100%; background-color: #e9ecef; border-radius: 5px; margin-top: 10px; height: 10px; }
                .progress-bar { height: 100%; border-radius: 5px; background-color: var(--primary-color); }
                .review-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
                .review-table th, .review-table td { border: 1px solid var(--border-color); padding: 12px 15px; text-align: right; }
                .review-table thead { background-color: var(--primary-color); color: white; font-weight: 700; }
                .review-table tbody tr:nth-child(even) { background-color: var(--light-gray); }
                .review-table .stars { color: var(--secondary-color); font-size: 18px; }
                .comments-cell { max-width: 300px; white-space: pre-wrap; word-wrap: break-word; }
                .footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid var(--border-color); font-size: 12px; color: #999; }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="header">
                    <div class="header-logo">فندق ماريوت</div>
                    <div class="header-info">
                        <h1>التقرير التراكمي للأداء</h1>
                        <p>تاريخ الإصدار: ${today.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                </div>
                <div class="section-title">ملخص الأداء الكلي</div>
                <div class="summary-grid">
                    <div class="summary-card">
                        <h3>إجمالي التقييمات المستلمة</h3>
                        <div class="score">${stats.total_reviews}</div>
                    </div>
                    <div class="summary-card">
                        <h3>متوسط التقييم العام</h3>
                        <div class="score">${((Number(stats.avg_cleanliness) + Number(stats.avg_reception) + Number(stats.avg_services)) / 3).toFixed(2)}<small>/5</small></div>
                    </div>
                </div>
                <div class="summary-grid" style="grid-template-columns: repeat(3, 1fr);">
                    <div class="summary-card">
                        <h3>النظافة</h3>
                        <div class="score">${Number(stats.avg_cleanliness).toFixed(2)}</div>
                        <div class="progress-bar-container"><div class="progress-bar" style="width: ${stats.avg_cleanliness / 5 * 100}%;"></div></div>
                    </div>
                    <div class="summary-card">
                        <h3>خدمات الاستقبال</h3>
                        <div class="score">${Number(stats.avg_reception).toFixed(2)}</div>
                        <div class="progress-bar-container"><div class="progress-bar" style="width: ${stats.avg_reception / 5 * 100}%;"></div></div>
                    </div>
                    <div class="summary-card">
                        <h3>الخدمات العامة</h3>
                        <div class="score">${Number(stats.avg_services).toFixed(2)}</div>
                        <div class="progress-bar-container"><div class="progress-bar" style="width: ${stats.avg_services / 5 * 100}%;"></div></div>
                    </div>
                </div>
                <div class="section-title">تفاصيل آخر ${recentReviews.length} تقييمات</div>
                <table class="review-table">
                    <thead>
                        <tr>
                            <th>رقم الغرفة</th><th>النظافة</th><th>الاستقبال</th><th>الخدمات</th><th class="comments-cell">الملاحظات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recentReviews.map(review => `
                            <tr>
                                <td>${review.roomNumber}</td>
                                <td class="stars">${'★'.repeat(review.cleanliness)}${'☆'.repeat(5 - review.cleanliness)}</td>
                                <td class="stars">${'★'.repeat(review.reception)}${'☆'.repeat(5 - review.reception)}</td>
                                <td class="stars">${'★'.repeat(review.services)}${'☆'.repeat(5 - review.services)}</td>
                                <td class="comments-cell">${review.comments || '<em>لا يوجد</em>'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="footer">
                    <p>© ${new Date().getFullYear()} فندق ماريوت | تقرير تم إنشاؤه بواسطة نظام التقييم الآلي.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    let browser = null;
    try {
        console.log("🚀 Launching browser for PDF generation on Render...");

        // --- 2. إعداد Puppeteer لمنصة Render ---
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            // !! تعديل مهم هنا !!
            // هذا السطر يجد مسار المتصفح الذي نزلته مكتبة @sparticuz/chromium تلقائياً
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });
        // ------------------------------------

        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
        });
        
        console.log("📄 PDF buffer created successfully on Render.");
        return pdfBuffer;
    } catch (error) {
        console.error("❌ Error during PDF generation on Render:", error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
            console.log("✅ Browser closed.");
        }
    }
}


module.exports = { sendReportEmail, generatePdf };

// END OF FILE notifications.js
