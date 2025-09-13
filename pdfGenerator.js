// START OF FILE pdfGenerator.js (FINAL DESIGN WITH DESCRIPTIVE SUMMARY)

const puppeteer = require('puppeteer');

// --- Helper Functions (as before) ---
function getRatingText(rating) {
    switch (parseInt(rating, 10)) {
        case 5: return 'ممتاز';
        case 3: return 'جيد';
        case 1: return 'ضعيف';
        default: return '-';
    }
}
function getRatingColor(rating) {
    const r = parseInt(rating, 10);
    if (r === 5) return '#28a745';
    if (r === 3) return '#ffc107';
    if (r === 1) return '#dc3545';
    return '#6c757d';
}

// دالة لتحويل المتوسط الرقمي إلى نص وصفي
function getAverageRatingText(average) {
    const score = parseFloat(average);
    if (score >= 4) return 'ممتاز';
    if (score >= 2) return 'جيد';
    if (score > 0) return 'ضعيف';
    return '-';
}
// دالة لتلوين نص المتوسط
function getAverageRatingColor(average) {
    const score = parseFloat(average);
    if (score >= 4) return '#28a745';
    if (score >= 2) return '#ffc107';
    if (score > 0) return '#dc3545';
    return '#6c757d';
}


async function createCumulativePdfReport(stats, recentReviews, logoDataUri) {
    const today = new Date();

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
            <style>
                :root { --primary-color: #003c71; --secondary-color: #d4a75c; } 
                body { font-family: 'Tajawal', sans-serif; -webkit-print-color-adjust: exact; font-size: 11px; } 
                .page { padding: 30px; } 
                .header { text-align: center; margin-bottom: 25px; } 
                .header img { max-width: 180px; } 
                h1 { color: var(--primary-color); font-size: 20px; } 
                .section-title { font-size: 18px; font-weight: 700; color: var(--primary-color); border-bottom: 2px solid var(--secondary-color); padding-bottom: 8px; margin-top: 25px; margin-bottom: 15px; } 
                .summary-table { width: 100%; border-collapse: collapse; } 
                .summary-table td { border: 1px solid #dee2e6; padding: 8px; text-align: center; } 
                .summary-table td:first-child { font-weight: bold; background-color: #f8f9fa; } 
                .summary-table .rating-cell { font-weight: bold; font-size: 14px; }
                .review-block { margin-bottom: 20px; border: 1px solid #ccc; border-radius: 8px; overflow: hidden; }
                .guest-info-table, .review-table { width: 100%; border-collapse: collapse; }
                .guest-info-table th { background-color: #f2f2f2; font-weight: bold; text-align: center; border: 1px solid #dee2e6; padding: 8px; }
                .guest-info-table td { border: 1px solid #dee2e6; padding: 8px; text-align: center; }
                .review-table th, .review-table td { border: 1px solid #dee2e6; padding: 7px; text-align: center; vertical-align: middle; } 
                .review-table thead { background-color: var(--primary-color); color: white; } 
                .rating-cell { font-weight: bold; } 
                .comments-cell { text-align: right !important; white-space: pre-wrap; word-wrap: break-word; }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="header">
                    <img src="${logoDataUri}" alt="Marriott Aden Logo">
                    <h1>تقرير استبيان الغرف والأجنحة</h1>
                    <p>تاريخ الإصدار: ${today.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                
                <div class="section-title">ملخص متوسط التقييمات (${stats.total_reviews} تقييم)</div>
                <table class="summary-table">
                    <tbody>
                        <tr>
                            <td>النظافة</td><td class="rating-cell" style="color: ${getAverageRatingColor(stats.avg_cleanliness)}">${getAverageRatingText(stats.avg_cleanliness)}</td>
                            <td>الصيانة</td><td class="rating-cell" style="color: ${getAverageRatingColor(stats.avg_maintenance)}">${getAverageRatingText(stats.avg_maintenance)}</td>
                        </tr>
                        <tr>
                            <td>الاستقبال</td><td class="rating-cell" style="color: ${getAverageRatingColor(stats.avg_reception)}">${getAverageRatingText(stats.avg_reception)}</td>
                            <td>دورة المياه</td><td class="rating-cell" style="color: ${getAverageRatingColor(stats.avg_bathroom)}">${getAverageRatingText(stats.avg_bathroom)}</td>
                        </tr>
                        <tr>
                            <td>المغسلة</td><td class="rating-cell" style="color: ${getAverageRatingColor(stats.avg_laundry)}">${getAverageRatingText(stats.avg_laundry)}</td>
                            <td>الأمن</td><td class="rating-cell" style="color: ${getAverageRatingColor(stats.avg_security)}">${getAverageRatingText(stats.avg_security)}</td>
                        </tr>
                        <tr>
                            <td>القاعات</td><td class="rating-cell" style="color: ${getAverageRatingColor(stats.avg_halls)}">${getAverageRatingText(stats.avg_halls)}</td>
                            <td>المطعم</td><td class="rating-cell" style="color: ${getAverageRatingColor(stats.avg_restaurant)}">${getAverageRatingText(stats.avg_restaurant)}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="section-title">تفاصيل التقييمات الأخيرة</div>
                ${recentReviews.map(review => `
                <div class="review-block">
                    <table class="guest-info-table">
                        <thead><tr><th>النزيل</th><th>الطابق</th><th>الغرفة</th><th>التاريخ</th><th>الجوال</th><th>البريد الإلكتروني</th></tr></thead>
                        <tbody><tr><td>${review.guestName || '-'}</td><td>${review.floor || '-'}</td><td>${review.roomNumber || '-'}</td><td>${review.date || '-'}</td><td>${review.mobileNumber || '-'}</td><td>${review.email || '-'}</td></tr></tbody>
                    </table>
                    <table class="review-table">
                        <thead><tr><td>النظافة</td><td>الصيانة</td><td>الاستقبال</td><td>دورة المياه</td><td>المغسلة</td><td>الأمن</td><td>القاعات</td><td>المطعم</td></tr></thead>
                        <tbody>
                            <tr>
                                <td class="rating-cell" style="color: ${getRatingColor(review.cleanliness)}">${getRatingText(review.cleanliness)}</td>
                                <td class="rating-cell" style="color: ${getRatingColor(review.maintenance)}">${getRatingText(review.maintenance)}</td>
                                <td class="rating-cell" style="color: ${getRatingColor(review.reception)}">${getRatingText(review.reception)}</td>
                                <td class="rating-cell" style="color: ${getRatingColor(review.bathroom)}">${getRatingText(review.bathroom)}</td>
                                <td class="rating-cell" style="color: ${getRatingColor(review.laundry)}">${getRatingText(review.laundry)}</td>
                                <td class="rating-cell" style="color: ${getRatingColor(review.security)}">${getRatingText(review.security)}</td>
                                <td class="rating-cell" style="color: ${getRatingColor(review.halls)}">${getRatingText(review.halls)}</td>
                                <td class="rating-cell" style="color: ${getRatingColor(review.restaurant)}">${getRatingText(review.restaurant)}</td>
                            </tr>
                            ${review.comments ? `<tr><td colspan="8" class="comments-cell"><strong>مقترحات النزيل:</strong> ${review.comments}</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>
                `).join('')}
            </div>
        </body></html>
    `;

    const emailHtmlContent = `<div dir="rtl" style="text-align: center; padding: 20px;"><h1>تقرير جديد لاستبيان الغرف والأجنحة</h1><p>التقرير المفصل مرفق.</p></div>`;

    let browser = null;
    try {
        browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
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
