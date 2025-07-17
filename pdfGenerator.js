// START OF FILE pdfGenerator.js (GENERATES BOTH PDF & EMAIL HTML)

const puppeteer = require('puppeteer');

// --- دوال مساعدة (تبقى كما هي) ---
function getRatingText(rating) {
    switch (parseInt(rating, 10)) {
        case 5: return 'ممتاز';
        case 4: return 'جيد جداً';
        case 3: return 'جيد';
        case 2: return 'مقبول';
        case 1: return 'ضعيف';
        default: return '-';
    }
}
function getRatingColor(rating) {
    const r = parseInt(rating, 10);
    if (r >= 4) return '#28a745';
    if (r === 3) return '#ffc107';
    if (r <= 2) return '#dc3545';
    return '#6c757d';
}

async function createCumulativePdfReport(stats, recentReviews) {
    const today = new Date();
    const overallAvg = ((parseFloat(stats.avg_reception) || 0) + (parseFloat(stats.avg_cleanliness) || 0) + (parseFloat(stats.avg_comfort) || 0) + (parseFloat(stats.avg_facilities) || 0) + (parseFloat(stats.avg_location) || 0) + (parseFloat(stats.avg_value) || 0)) / 6;

    // --- 1. إنشاء HTML المفصل الخاص بملف PDF ---
    const pdfHtmlContent = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
            <style>
                /* ... كل أكواد الـ CSS المعقدة للـ PDF تبقى هنا كما في الرد السابق ... */
                :root { --primary-color: #003c71; --secondary-color: #d4a75c; --text-color: #333; --light-gray: #f8f9fa; --border-color: #dee2e6; }
                body { font-family: 'Tajawal', sans-serif; -webkit-print-color-adjust: exact; } .page { padding: 40px; } .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid var(--primary-color); padding-bottom: 20px; } .header-logo { font-size: 28px; font-weight: 700; color: var(--primary-color); } .header-info { text-align: left; } .header-info h1 { margin: 0; font-size: 24px; color: var(--primary-color); } .header-info p { margin: 5px 0 0; color: #6c757d; } .section-title { font-size: 22px; font-weight: 700; color: var(--primary-color); border-bottom: 2px solid var(--secondary-color); padding-bottom: 10px; margin-top: 40px; margin-bottom: 20px; } .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 30px; } .summary-card { background-color: var(--light-gray); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; text-align: center; } .summary-card h3 { margin: 0 0 10px 0; font-size: 16px; color: var(--primary-color); font-weight: 500; } .summary-card .score { font-size: 36px; font-weight: 700; color: var(--secondary-color); } .summary-card .score small { font-size: 18px; color: #6c757d; } .review-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; } .review-table th, .review-table td { border: 1px solid var(--border-color); padding: 12px; text-align: center; vertical-align: middle;} .review-table thead { background-color: var(--primary-color); color: white; font-weight: 700; } .review-table tbody tr:nth-child(even) { background-color: var(--light-gray); } .rating-cell { font-weight: bold; } .comments-cell { text-align: right !important; max-width: 250px; white-space: pre-wrap; word-wrap: break-word; } .footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid var(--border-color); font-size: 12px; color: #999; }
            </style>
        </head>
        <body>
            <div class="page">
                 <!-- ... محتوى الـ PDF المفصل بالجدول ... -->
                 <div class="header"><div class="header-logo">فندق ماريوت</div><div class="header-info"><h1>التقرير الدوري للتقييمات</h1><p>تاريخ الإصدار: ${today.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p></div></div>
                 <div class="section-title">ملخص الأداء العام</div><div class="summary-grid"><div class="summary-card"><h3>إجمالي التقييمات</h3><div class="score">${stats.total_reviews}</div></div><div class="summary-card"><h3>المتوسط العام</h3><div class="score">${overallAvg.toFixed(2)}<small>/5</small></div></div></div>
                 <div class="section-title">تفاصيل آخر ${recentReviews.length} تقييمات</div>
                 <table class="review-table"><thead><tr><th>الغرفة</th><th>الاستقبال</th><th>النظافة</th><th>الراحة</th><th>المرافق</th><th>الموقع</th><th>القيمة</th><th class="comments-cell">الملاحظات</th></tr></thead><tbody>
                 ${recentReviews.map(review => `<tr><td>${review.roomNumber}</td><td class="rating-cell" style="color: ${getRatingColor(review.reception)};">${getRatingText(review.reception)}</td><td class="rating-cell" style="color: ${getRatingColor(review.cleanliness)};">${getRatingText(review.cleanliness)}</td><td class="rating-cell" style="color: ${getRatingColor(review.comfort)};">${getRatingText(review.comfort)}</td><td class="rating-cell" style="color: ${getRatingColor(review.facilities)};">${getRatingText(review.facilities)}</td><td class="rating-cell" style="color: ${getRatingColor(review.location)};">${getRatingText(review.location)}</td><td class="rating-cell" style="color: ${getRatingColor(review.value)};">${getRatingText(review.value)}</td><td class="comments-cell">${review.comments || '<em>-</em>'}</td></tr>`).join('')}
                 </tbody></table><div class="footer"><p>© ${new Date().getFullYear()} فندق ماريوت</p></div>
            </div>
        </body></html>
    `;

    // --- 2. إنشاء HTML المبسط الخاص بالبريد الإلكتروني ---
    const emailHtmlContent = `
        <div dir="rtl" style="font-family: 'Tajawal', Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
            <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 25px; border-radius: 10px;">
                <h1 style="color: #003c71; text-align: center;">التقرير الدوري للتقييمات</h1>
                <p style="text-align: center; color: #666;">تاريخ: ${today.toLocaleDateString('ar-EG')}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <h2 style="color: #003c71;">ملخص الأداء:</h2>
                <p><strong>إجمالي التقييمات في هذه الفترة:</strong> ${stats.total_reviews}</p>
                <p><strong>المتوسط العام للتقييمات:</strong> ${overallAvg.toFixed(2)} من 5</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <h2 style="color: #003c71;">تفاصيل آخر ${recentReviews.length} تقييمات:</h2>
                <ul style="list-style-type: none; padding: 0;">
                    ${recentReviews.map(review => `
                        <li style="background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                            <p style="margin: 0 0 10px 0;"><strong>رقم الغرفة: ${review.roomNumber}</strong></p>
                            <p style="margin: 5px 0;">- الاستقبال: <strong style="color: ${getRatingColor(review.reception)};">${getRatingText(review.reception)}</strong></p>
                            <p style="margin: 5px 0;">- النظافة: <strong style="color: ${getRatingColor(review.cleanliness)};">${getRatingText(review.cleanliness)}</strong></p>
                            <p style="margin: 5px 0;">- الراحة: <strong style="color: ${getRatingColor(review.comfort)};">${getRatingText(review.comfort)}</strong></p>
                            <p style="margin: 5px 0;">- المرافق: <strong style="color: ${getRatingColor(review.facilities)};">${getRatingText(review.facilities)}</strong></p>
                            <p style="margin: 5px 0;">- الموقع: <strong style="color: ${getRatingColor(review.location)};">${getRatingText(review.location)}</strong></p>
                            <p style="margin: 5px 0;">- القيمة: <strong style="color: ${getRatingColor(review.value)};">${getRatingText(review.value)}</strong></p>
                            ${review.comments ? `<p style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ccc;"><em>ملاحظات: ${review.comments}</em></p>` : ''}
                        </li>
                    `).join('')}
                </ul>
                <p style="text-align: center; margin-top: 25px; font-size: 12px; color: #888;">هذا تقرير آلي. ملف PDF مفصل مرفق مع هذه الرسالة.</p>
            </div>
        </div>
    `;

    // --- 3. إنشاء الـ PDF وإعادة البيانات ---
    let browser = null;
    try {
        browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(pdfHtmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' } });
        
        // إعادة النسخة المبسطة للإيميل + ملف الـ PDF
        return { pdfBuffer, emailHtmlContent };

    } catch (error) {
        console.error("❌ Error during PDF generation:", error);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { createCumulativePdfReport };
// END OF FILE pdfGenerator.js
