// START OF FILE server.js (TESTING VERSION)

const express = require('express');
const cors = require('cors');
// const cron = require('node-cron'); // لا نحتاج للجدولة في النسخة التجريبية
const { Client } = require('pg');
require('dotenv').config();

const { sendReportEmail } = require('./notifications.js');
const { createCumulativePdfReport } = require('./pdfGenerator.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const dbClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

let dbReady = false;
let newReviewsCounter = 0;
const REVIEWS_THRESHOLD = 3; // <-- غير هذا الرقم إلى 5 إذا أردت

// ------------------- دالة مركزية لإنشاء التقارير (للتجربة) -------------------
async function generateAndSendReport(period, title, interval) {
    console.log(`[TEST RUN] 🚀 Starting generation for ${title}...`);
    try {
        // في النسخة التجريبية، سنجمع آخر 5 تقييمات لكل التقارير
        const recentReviewsQuery = `
            SELECT * FROM reviews 
            ORDER BY id DESC
            LIMIT 5
        `;
        // ونحسب الإحصائيات بناءً عليها
        const statsQuery = `
            WITH recent_reviews AS (
                SELECT * FROM reviews ORDER BY id DESC LIMIT 5
            )
            SELECT 
                COUNT(id) as total_reviews,
                AVG(reception) as avg_reception, AVG(cleanliness) as avg_cleanliness,
                AVG(comfort) as avg_comfort, AVG(facilities) as avg_facilities,
                AVG(location) as avg_location, AVG(value) as avg_value
            FROM recent_reviews
        `;
        
        const statsRes = await dbClient.query(statsQuery);
        const recentRes = await dbClient.query(recentReviewsQuery);

        const stats = statsRes.rows[0];
        const recentReviews = recentRes.rows;

        if (stats.total_reviews == 0) {
            console.log(`[TEST RUN] ℹ️ No reviews found for ${title}. Skipping.`);
            return;
        }

        const { pdfBuffer, htmlContent } = await createCumulativePdfReport(stats, recentReviews);
        
        const attachments = [{
            filename: `TEST-${period}-report-${new Date().toISOString().slice(0, 10)}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
        }];

        const emailSubject = `📊 [تجريبي] ${title} (${stats.total_reviews} تقييم)`;
        await sendReportEmail(emailSubject, htmlContent, attachments);
        console.log(`[TEST RUN] ✅ ${title} sent successfully.`);

    } catch (err) {
        console.error(`[TEST RUN] ❌ CRITICAL: Failed to generate ${title}:`, err);
    }
}


// ------------------- دالة تشغيل التقارير التجريبية -------------------
async function runAllTestReports() {
    console.log("--- Starting Test Report Generation ---");
    // استدعاء التقارير الثلاثة واحدًا تلو الآخر
    await generateAndSendReport('daily', 'التقرير اليومي', '1 DAY');
    await generateAndSendReport('weekly', 'التقرير الأسبوعي', '7 DAY');
    await generateAndSendReport('monthly', 'التقرير الشهري', '1 MONTH');
    console.log("--- Finished Test Report Generation ---");
}


// ------------------- تشغيل السيرفر وقاعدة البيانات -------------------
app.listen(PORT, () => {
    console.log(`🚀 Server is listening on port ${PORT}`);
    dbClient.connect()
        .then(async () => {
            console.log('✅ Connected to PostgreSQL DB.');
            await dbClient.query(`
                CREATE TABLE IF NOT EXISTS reviews (
                    id SERIAL PRIMARY KEY, "roomNumber" VARCHAR(50), reception INTEGER,
                    cleanliness INTEGER, comfort INTEGER, facilities INTEGER, location INTEGER,
                    value INTEGER, comments TEXT, "createdAt" TIMESTAMPTZ DEFAULT NOW()
                );
            `);
            dbReady = true;
            console.log("✅ Database is ready for TESTING MODE.");
        })
        .catch(error => {
            console.error('❌ CRITICAL: DB Connection/Setup Failed:', error);
        });
});

// ------------------- نقطة النهاية لاستقبال التقييمات (النسخة التجريبية) -------------------
app.post('/api/review', async (req, res) => {
    if (!dbReady) {
        return res.status(503).json({ success: false, message: 'السيرفر غير جاهز حاليًا.' });
    }
    try {
        const { roomNumber, reception, cleanliness, comfort, facilities, location, value, comments } = req.body;
        
        const query = {
            text: 'INSERT INTO reviews("roomNumber", reception, cleanliness, comfort, facilities, location, value, comments) VALUES($1, $2, $3, $4, $5, $6, $7, $8)',
            values: [roomNumber, reception, cleanliness, comfort, facilities, location, value, comments],
        };
        
        await dbClient.query(query);
        newReviewsCounter++;
        console.log(`Review received. Counter is now: ${newReviewsCounter}/${REVIEWS_THRESHOLD}`);

        // التحقق من الوصول إلى العدد المطلوب من التقييمات
        if (newReviewsCounter >= REVIEWS_THRESHOLD) {
            console.log(`🚀 Threshold reached! Triggering all test reports.`);
            
            // تشغيل دالة إرسال التقارير التجريبية (لا نحتاج لـ await هنا)
            runAllTestReports(); 
            
            newReviewsCounter = 0; // إعادة تعيين العداد
            console.log("Counter reset. Main thread responding to user.");
        }

        res.status(201).json({ success: true, message: 'شكرًا لك! تم استلام تقييمك بنجاح.' });

    } catch (error) {
        console.error('❌ ERROR in /api/review endpoint:', error);
        res.status(500).json({ success: false, message: 'خطأ فادح في السيرفر.' });
    }
});
// END OF FILE server.js
