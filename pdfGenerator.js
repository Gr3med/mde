// START OF FILE pdfGenerator.js (WITH DETAILED SUMMARY)

const puppeteer = require('puppeteer');

// --- Helper Functions (as before) ---
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
function getOverallRatingText(average) {
    const score = parseFloat(average);
    if (score >= 4.5) return 'ممتاز';
    if (score >= 3.5) return 'جيد جداً';
    if (score >= 2.5) return 'جيد';
    if (score >= 1.5) return 'مقبول';
    return 'ضعيف';
}
function getOverallRatingColor(average) {
    const score = parseFloat(average);
    if (score >= 3.5) return '#28a745';
    if (score >= 2.5) return '#ffc107';
    return '#dc3545';
}


async function createCumulativePdfReport(stats, recentReviews) {
    const today = new Date();
    const overallAvg = ((parseFloat(stats.avg_reception) || 0) + (parseFloat(stats.avg_cleanliness) || 0) + (parseFloat(stats.avg_comfort) || 0) + (parseFloat(stats.avg_facilities) || 0) + (parseFloat(stats.avg_location) || 0) + (parseFloat(stats.avg_value) || 0)) / 6;
    const overallRatingText = getOverallRatingText(overallAvg);
    const overallRatingColor = getOverallRatingColor(overallAvg);

    // --- 1. Detailed HTML for PDF ---
    const pdfHtmlContent = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
            <style>
                :root { --primary-color: #003c71; --secondary-color: #d4a75c; } body { font-family: 'Tajawal', sans-serif; -webkit-print-color-adjust: exact; } .page { padding: 40px; } .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid var(--primary-color); padding-bottom: 20px; } .header-logo { font-size: 28px; font-weight: 700; color: var(--primary-color); } .header-info { text-align: left; } h1 { font-size: 24px; color: var(--primary-color); } p { color: #6c757d; } .section-title { font-size: 22px; font-weight: 700; color: var(--primary-color); border-bottom: 2px solid var(--secondary-color); padding-bottom: 10px; margin-top: 40px; margin-bottom: 20px; } .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px; } .summary-card { background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 12px; padding: 15px; text-align: center; } h3 { margin: 0 0 10px 0; font-size: 15px; color: var(--primary-color); } .score { font-size: 32px; font-weight: 700; color: var(--secondary-color); } .overall-text { font-size: 24px; font-weight: bold; margin-bottom: 5px; } .overall-score-number { font-size: 18px; color: #6c757d; } .grid-span-2 { grid-column: span 2; } .review-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; } th, td { border: 1px solid #dee2e6; padding: 12px; text-align: center; vertical-align: middle;} thead { background-color: var(--primary-color); color: white; } tbody tr:nth-child(even) { background-color: #f8f9fa; } .rating-cell { font-weight: bold; } .comments-cell { text-align: right !important; } .footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #999; }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="header"><div class="header-logo">فندق ماريوت</div><div class="header-info"><h1>التقرير الدوري للتقييمات</h1><p>${today.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p></div></div>
                
                <div class="section-title">ملخص الأداء العام</div>
                <div class="summary-grid">
                    <div class="summary-card"><h3>إجمالي التقييمات</h3><div class="score">${stats.total_reviews}</div></div>
                    <div class="summary-card grid-span-2">
                        <h3>المستوى العام</h3>
                        <div class="overall-text" style="color: ${overallRatingColor};">${overallRatingText}</div>
                        <div class="overall-score-number">(${overallAvg.toFixed(2)} / 5)</div>
                    </div>
                    <div class="summary-card"><h3>معدل الاستقبال</h3><div class="score">${(parseFloat(stats.avg_reception) || 0).toFixed(2)}</div></div>
                    <div class="summary-card"><h3>معدل النظافة</h3><div class="score">${(parseFloat(stats.avg_cleanliness) || 0).toFixed(2)}</div></div>
                    <div class="summary-card"><h3>معدل الراحة</h3><div class="score">${(parseFloat(stats.avg_comfort) || 0).toFixed(2)}</div></div>
                    <div class="summary-card"><h3>معدل المرافق</h3><div class="score">${(parseFloat(stats.avg_facilities) || 0).toFixed(2)}</div></div>
                    <div class="summary-card"><h3>معدل الموقع</h3><div class="score">${(parseFloat(stats.avg_location) || 0).toFixed(2)}</div></div>
                    <div class="summary-card"><h3>معدل القيمة</h3><div class="score">${(parseFloat(stats.avg_value) || 0).toFixed(2)}</div></div>
                </div>
                
                <div class="section-title">تفاصيل آخر ${recentReviews.length} تقييمات</div>
                <table class="review-table"><thead><tr><th>الغرفة</th><th>الاستقبال</th><th>النظافة</th><th>الراحة</th><th>المرافق</th><th>الموقع</th><th>القيمة</th><th class="comments-cell">الملاحظات</th></tr></thead><tbody>
                ${recentReviews.map(review => `<tr><td>${review.roomNumber}</td><td class="rating-cell" style="color: ${getRatingColor(review.reception)};">${getRatingText(review.reception)}</td><td class="rating-cell" style="color: ${getRatingColor(review.cleanliness)};">${getRatingText(review.cleanliness)}</td><td class="rating-cell" style="color: ${getRatingColor(review.comfort)};">${getRatingText(review.comfort)}</td><td class="rating-cell" style="color: ${getRatingColor(review.facilities)};">${getRatingText(review.facilities)}</td><td class="rating-cell" style="color: ${getRatingColor(review.location)};">${getRatingText(review.location)}</td><td class="rating-cell" style="color: ${getRatingColor(review.value)};">${getRatingText(review.value)}</td><td class="comments-cell">${review.comments || '-'}</td></tr>`).join('')}
                </tbody></table>
                <div class="footer"><p>© ${new Date().getFullYear()} فندق ماريوت</p></div>
            </div>
        </body></html>
    `;

    // --- 2. Simplified HTML for Email Body ---
    const emailHtmlContent = `
        <div dir="rtl" style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
            <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 25px; border-radius: 10px;">
                <h1 style="color: #003c71; text-align: center;">التقرير الدوري للتقييمات</h1>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <h2 style="color: #003c71;">ملخص الأداء:</h2>
                <p><strong>إجمالي التقييمات في الفترة:</strong> ${stats.total_reviews}</p>
                <p><strong>المستوى العام للتقييم:</strong> <strong style="color: ${overallRatingColor}; font-size: 1.2em;">${overallRatingText}</strong> (${overallAvg.toFixed(2)} / 5)</p>
                <p style="margin-top: 15px;"><strong>تفاصيل المعدلات:</strong></p>
                <ul style="padding-right: 20px; margin: 0;">
                    <li>الاستقبال: <strong>${(parseFloat(stats.avg_reception) || 0).toFixed(2)}</strong></li>
                    <li>النظافة: <strong>${(parseFloat(stats.avg_cleanliness) || 0).toFixed(2)}</strong></li>
                    <li>الراحة: <strong>${(parseFloat(stats.avg_comfort) || 0).toFixed(2)}</strong></li>
                    <li>المرافق: <strong>${(parseFloat(stats.avg_facilities) || 0).toFixed(2)}</strong></li>
                    <li>الموقع: <strong>${(parseFloat(stats.avg_location) || 0).toFixed(2)}</strong></li>
                    <li>القيمة: <strong>${(parseFloat(stats.avg_value) || 0).toFixed(2)}</strong></li>
                </ul>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <h2 style="color: #003c71;">تفاصيل آخر التقييمات:</h2>
                ${recentReviews.map(review => `<div style="background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                    <p style="margin: 0 0 10px;"><strong>غرفة: ${review.roomNumber}</strong></p>
                    <p style="margin: 2px 0;">- الاستقبال: <strong style="color: ${getRatingColor(review.reception)};">${getRatingText(review.reception)}</strong></p>
                    <p style="margin: 2px 0;">- النظافة: <strong style="color: ${getRatingColor(review.cleanliness)};">${getRatingText(review.cleanliness)}</strong></p>
                    <p style="margin: 2px 0;">- الراحة: <strong style="color: ${getRatingColor(review.comfort)};">${getRatingText(review.comfort)}</strong></p>
                    <p style="margin: 2px 0;">- المرافق: <strong style="color: ${getRatingColor(review.facilities)};">${getRatingText(review.facilities)}</strong></p>
                    <p style="margin: 2px 0;">- الموقع: <strong style="color: ${getRatingColor(review.location)};">${getRatingText(review.location)}</strong></p>
                    <p style="margin: 2px 0;">- القيمة: <strong style="color: ${getRatingColor(review.value)};">${getRatingText(review.value)}</strong></p>
                    ${review.comments ? `<p style="margin-top: 10px; border-top: 1px dashed #ccc; padding-top: 10px;"><em>ملاحظات: ${review.comments}</em></p>` : ''}
                </div>`).join('')}
                <p style="text-align: center; margin-top: 25px; font-size: 12px; color: #888;">ملف PDF مفصل مرفق مع هذه الرسالة.</p>
            </div>
        </div>
    `;

    // --- 3. Generate PDF and return data ---
    let browser = null;
    try {
        browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(pdfHtmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' } });
        
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
