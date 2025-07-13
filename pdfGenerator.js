// START OF FILE pdfGenerator.js

const puppeteer = require('puppeteer'); // استخدام puppeteer بدلاً من puppeteer-core
const path = require('path');

async function createCumulativePdfReport(stats, recentReviews) {
    const today = new Date();

    // --- !! تصميم HTML و CSS الاحترافي الجديد !! ---
    // تأكد من تضمين خط Tajawal من Google Fonts
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
            <style>
                /* تضمين CSS الخاص بك */
                :root {
                    --primary-color: #003c71; /* Marriott Blue */
                    --secondary-color: #d4a75c; /* Gold Accent */
                    --text-color: #333;
                    --light-gray: #f8f9fa;
                    --border-color: #dee2e6;
                }
                body {
                    font-family: 'Tajawal', sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: #fff;
                    color: var(--text-color);
                    -webkit-print-color-adjust: exact; /* لضمان طباعة الألوان في PDF */
                }
                .page {
                    padding: 40px;
                    background: white;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 3px solid var(--primary-color);
                    padding-bottom: 20px;
                }
                .header-logo {
                    font-size: 28px;
                    font-weight: 700;
                    color: var(--primary-color);
                }
                .header-info {
                    text-align: left;
                }
                .header-info h1 {
                    margin: 0;
                    font-size: 24px;
                    color: var(--primary-color);
                }
                .header-info p {
                    margin: 5px 0 0;
                    color: #6c757d;
                }
                .section-title {
                    font-size: 22px;
                    font-weight: 700;
                    color: var(--primary-color);
                    border-bottom: 2px solid var(--secondary-color);
                    padding-bottom: 10px;
                    margin-top: 40px;
                    margin-bottom: 20px;
                }
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 20px;
                    margin-bottom: 30px;
                }
                .summary-card {
                    background-color: var(--light-gray);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 20px;
                    text-align: center;
                }
                .summary-card h3 {
                    margin: 0 0 15px 0;
                    font-size: 18px;
                    color: var(--primary-color);
                    font-weight: 500;
                }
                .summary-card .score {
                    font-size: 40px;
                    font-weight: 700;
                    color: var(--secondary-color);
                }
                 .summary-card .score small {
                    font-size: 20px;
                    color: #6c757d;
                }
                .progress-bar-container {
                    width: 100%;
                    background-color: #e9ecef;
                    border-radius: 5px;
                    margin-top: 10px;
                    height: 10px;
                }
                .progress-bar {
                    height: 100%;
                    border-radius: 5px;
                    background-color: var(--primary-color);
                }
                .review-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                    font-size: 14px;
                }
                .review-table th, .review-table td {
                    border: 1px solid var(--border-color);
                    padding: 12px 15px;
                    text-align: right;
                }
                .review-table thead {
                    background-color: var(--primary-color);
                    color: white;
                    font-weight: 700;
                }
                .review-table tbody tr:nth-child(even) {
                    background-color: var(--light-gray);
                }
                .review-table .stars {
                    color: var(--secondary-color);
                    font-size: 18px;
                }
                .comments-cell {
                    max-width: 300px;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                .footer {
                    text-align: center;
                    margin-top: 50px;
                    padding-top: 20px;
                    border-top: 1px solid var(--border-color);
                    font-size: 12px;
                    color: #999;
                }
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
                        <div class="score">${((parseFloat(stats.avg_cleanliness) + parseFloat(stats.avg_reception) + parseFloat(stats.avg_services)) / 3).toFixed(2)}<small>/5</small></div>
                    </div>
                </div>
                
                <div class="summary-grid" style="grid-template-columns: repeat(3, 1fr);">
                    <div class="summary-card">
                        <h3>النظافة</h3>
                        <div class="score">${parseFloat(stats.avg_cleanliness).toFixed(2)}</div>
                        <div class="progress-bar-container"><div class="progress-bar" style="width: ${parseFloat(stats.avg_cleanliness) / 5 * 100}%;"></div></div>
                    </div>
                    <div class="summary-card">
                        <h3>خدمات الاستقبال</h3>
                        <div class="score">${parseFloat(stats.avg_reception).toFixed(2)}</div>
                        <div class="progress-bar-container"><div class="progress-bar" style="width: ${parseFloat(stats.avg_reception) / 5 * 100}%;"></div></div>
                    </div>
                    <div class="summary-card">
                        <h3>الخدمات العامة</h3>
                        <div class="score">${parseFloat(stats.avg_services).toFixed(2)}</div>
                        <div class="progress-bar-container"><div class="progress-bar" style="width: ${parseFloat(stats.avg_services) / 5 * 100}%;"></div></div>
                    </div>
                </div>

                <div class="section-title">تفاصيل آخر ${recentReviews.length} تقييمات</div>

                <table class="review-table">
                    <thead>
                        <tr>
                            <th>رقم الغرفة</th>
                            <th>النظافة</th>
                            <th>الاستقبال</th>
                            <th>الخدمات</th>
                            <th class="comments-cell">الملاحظات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recentReviews.map(review => `
                            <tr>
                                <td>${review.roomNumber}</td>
                                <td class="stars">${'★'.repeat(review.cleanliness)}${'☆'.repeat(5-review.cleanliness)}</td>
                                <td class="stars">${'★'.repeat(review.reception)}${'☆'.repeat(5-review.reception)}</td>
                                <td class="stars">${'★'.repeat(review.services)}${'☆'.repeat(5-review.services)}</td>
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
        // تحديث المسار الخاص بـ Chromium ليتناسب مع بيئات Linux
        // Puppeteer (النسخة الكاملة) تحاول البحث عن المتصفح تلقائياً.
        // إذا كنت تستخدم puppeteer-core، قد تحتاج لتحديد المسار
        // أما مع puppeteer، فغالباً ما يكون هذا السطر كافياً للتشغيل
        // على Render (بعد تثبيت Chrome عبر build command)
        browser = await puppeteer.launch({
            headless: true, // تأكد من أن headless: true لبيئات السيرفر
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // ضروري لبيئات السيرفر
            // executablePath: process.env.CHROME_BIN || null // يمكن استخدام هذا مع puppeteer-core أو إذا كان لديك مسار مخصص
        });
        const page = await browser.newPage();
        
        // تعيين Viewport كبير لضمان عرض كامل للعناصر وتجنب مشاكل التصميم
        await page.setViewport({ width: 1200, height: 1600 }); 
        
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true, // ضروري لطباعة الألوان والخلفيات
            margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' } // تأكد من أن الهوامش صفر إذا كانت في الـ HTML
        });
        console.log(`📄 Professional PDF report generated.`);
        return pdfBuffer; // نُعيد الـ Buffer مباشرة بدلاً من المسار
    } catch (error) {
        console.error("❌ Error during professional PDF generation:", error);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { createCumulativePdfReport };
// END OF FILE pdfGenerator.js