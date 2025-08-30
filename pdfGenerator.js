// START OF FILE pdfGenerator.js (WITH FLOOR/ROOM IN REPORT)

const puppeteer = require('puppeteer');

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

async function createCumulativePdfReport(stats, recentReviews) {
    const today = new Date();

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
            <style>
                :root { --primary-color: #003c71; --secondary-color: #d4a75c; } body { font-family: 'Tajawal', sans-serif; -webkit-print-color-adjust: exact; font-size: 11px; } .page { padding: 30px; } .header { text-align: center; margin-bottom: 25px; } .header img { max-width: 180px; } h1 { color: var(--primary-color); font-size: 20px; } .section-title { font-size: 18px; font-weight: 700; color: var(--primary-color); border-bottom: 2px solid var(--secondary-color); padding-bottom: 8px; margin-top: 25px; margin-bottom: 15px; } .review-table { width: 100%; border-collapse: collapse; margin-top: 15px; } th, td { border: 1px solid #dee2e6; padding: 7px; text-align: center; vertical-align: middle;} thead { background-color: var(--primary-color); color: white; } tbody tr:nth-child(even) { background-color: #f8f9fa; } .rating-cell { font-weight: bold; } .comments-cell { text-align: right !important; white-space: pre-wrap; word-wrap: break-word; min-width: 180px; }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="header">
                    <img src="https://logowik.com/content/uploads/images/marriott-hotels-resorts-suites6228.jpg" alt="Marriott Logo">
                    <h1>تقرير تقييم الخدمات</h1>
                    <p>تاريخ الإصدار: ${today.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                
                <div class="section-title">ملخص متوسط التقييمات (${stats.total_reviews} تقييم)</div>
                <table class="review-table">
                    <thead><tr><th>الفئة</th><th>المتوسط</th></tr></thead>
                    <tbody>
                        <tr><td>النظافة</td><td class="rating-cell">${(parseFloat(stats.avg_cleanliness) || 0).toFixed(2)}</td></tr>
                        <tr><td>الإضاءة</td><td class="rating-cell">${(parseFloat(stats.avg_lighting) || 0).toFixed(2)}</td></tr>
                        <tr><td>التكييف</td><td class="rating-cell">${(parseFloat(stats.avg_accooling) || 0).toFixed(2)}</td></tr>
                        <tr><td>خدمة الغرف</td><td class="rating-cell">${(parseFloat(stats.avg_roomservice) || 0).toFixed(2)}</td></tr>
                        <tr><td>جودة الطعام</td><td class="rating-cell">${(parseFloat(stats.avg_foodquality) || 0).toFixed(2)}</td></tr>
                        <tr><td>خدمة الانترنت</td><td class="rating-cell">${(parseFloat(stats.avg_internetservice) || 0).toFixed(2)}</td></tr>
                        <tr><td>التجربة العامة</td><td class="rating-cell">${(parseFloat(stats.avg_overallexperience) || 0).toFixed(2)}</td></tr>
                    </tbody>
                </table>

                <div class="section-title">تفاصيل التقييمات الأخيرة</div>
                ${recentReviews.map(review => `
                <table class="review-table">
                    <thead><tr>
                        <th colspan="4">النزيل: ${review.coordinatorName || '-'}</th>
                        <th colspan="4">الطابق: ${review.floor || '-'} / الغرفة: ${review.roomNumber || '-'}</th>
                        <th colspan="3">التاريخ: ${review.eventDate}</th>
                    </tr></thead>
                    <tbody>
                        <tr><td><strong>النظافة</strong></td><td><strong>الإضاءة</strong></td><td><strong>التكييف</strong></td><td><strong>خدمة الغرف</strong></td><td><strong>جودة الطعام</strong></td><td><strong>الانترنت</strong></td><td><strong>التجربة</strong></td></tr>
                        <tr>
                            <td class="rating-cell" style="color: ${getRatingColor(review.cleanliness)}">${getRatingText(review.cleanliness)}</td>
                            <td class="rating-cell" style="color: ${getRatingColor(review.lighting)}">${getRatingText(review.lighting)}</td>
                            <td class="rating-cell" style="color: ${getRatingColor(review.acCooling)}">${getRatingText(review.acCooling)}</td>
                            <td class="rating-cell" style="color: ${getRatingColor(review.roomService)}">${getRatingText(review.roomService)}</td>
                            <td class="rating-cell" style="color: ${getRatingColor(review.foodQuality)}">${getRatingText(review.foodQuality)}</td>
                            <td class="rating-cell" style="color: ${getRatingColor(review.internetService)}">${getRatingText(review.internetService)}</td>
                            <td class="rating-cell" style="color: ${getRatingColor(review.overallExperience)}">${getRatingText(review.overallExperience)}</td>
                        </tr>
                        ${review.comments ? `<tr><td colspan="7" class="comments-cell"><strong>ملاحظات:</strong> ${review.comments}</td></tr>` : ''}
                    </tbody>
                </table>
                `).join('')}
            </div>
        </body></html>
    `;

    const emailHtmlContent = `<div dir="rtl" style="text-align: center; padding: 20px;"><h1>تقرير جديد لتقييم الخدمات</h1><p>التقرير المفصل مرفق.</p></div>`;

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