// START OF FILE server.js

const express = require('express');
const cors = require('cors');
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

app.listen(PORT, () => {
    console.log(`🚀 Server is listening on port ${PORT}`);
    dbClient.connect()
        .then(() => {
            console.log('✅ Connected to PostgreSQL DB.');
            return dbClient.query(`
                CREATE TABLE IF NOT EXISTS reviews (
                    id SERIAL PRIMARY KEY,
                    "roomNumber" VARCHAR(50),
                    cleanliness INTEGER,
                    reception INTEGER,
                    services INTEGER,
                    comments TEXT,
                    "createdAt" TIMESTAMPTZ DEFAULT NOW()
                );
            `);
        })
        .then(() => {
            dbReady = true;
            console.log("✅ Database is ready to accept reviews.");
        })
        .catch(error => {
            console.error('❌ CRITICAL: DB Connection/Setup Failed:', error);
        });
});

/**
 * دالة لإنشاء وإرسال التقرير في الخلفية لتجنب تعطيل الخادم.
 * يتم استدعاؤها بدون 'await' لتعمل بشكل غير متزامن.
 */
async function generateAndSendReportInBackground() {
    console.log("⚙️ Starting background report generation...");
    try {
        // 1. جلب البيانات من قاعدة البيانات
        const statsRes = await dbClient.query(`
            SELECT 
                COUNT(id) as total_reviews, 
                AVG(cleanliness) as avg_cleanliness, 
                AVG(reception) as avg_reception, 
                AVG(services) as avg_services 
            FROM reviews
        `);
        const recentRes = await dbClient.query('SELECT * FROM reviews ORDER BY id DESC LIMIT 3');
        
        const stats = statsRes.rows[0];
        const recentReviews = recentRes.rows;

        // 2. إنشاء ملف PDF ومحتوى HTML (هذه هي العملية التي تستهلك الذاكرة)
        const { pdfBuffer, htmlContent } = await createCumulativePdfReport(stats, recentReviews);
        
        // 3. تجهيز المرفقات للبريد الإلكتروني
        const attachments = [{
            filename: `تقرير_التقييمات_${new Date().toISOString().slice(0, 10)}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
        }];

        // 4. إرسال البريد الإلكتروني
        const emailSubject = `📊 تقرير تقييمات فوري (الإجمالي: ${stats.total_reviews})`;
        await sendReportEmail(emailSubject, htmlContent, attachments);
        
        console.log("✅ Background report generation and email sent successfully.");

    } catch (err) {
        // تسجيل أي خطأ يحدث في الخلفية للمساعدة في التشخيص
        console.error("❌ CRITICAL: Background report generation failed:", err);
    }
}

// نقطة النهاية (Endpoint) لاستقبال التقييمات
app.post('/api/review', async (req, res) => {
    if (!dbReady) {
        return res.status(503).json({ success: false, message: 'السيرفر غير جاهز حاليًا.' });
    }
    try {
        const { roomNumber, cleanliness, reception, services, comments } = req.body;
        
        // حفظ التقييم في قاعدة البيانات
        await dbClient.query('INSERT INTO reviews ("roomNumber", cleanliness, reception, services, comments) VALUES ($1, $2, $3, $4, $5)', [roomNumber, cleanliness, reception, services, comments]);
        newReviewsCounter++;

        // التحقق مما إذا كان الوقت مناسبًا لإرسال التقرير
        if (newReviewsCounter >= 3) {
            console.log(`🚀 Triggering background report. Counter is now ${newReviewsCounter}.`);
            
            // **الحل:** استدعاء الدالة لتعمل في الخلفية (بدون await)
            generateAndSendReportInBackground();
            
            // إعادة تعيين العداد فورًا حتى لا يتم حظر الطلبات التالية
            newReviewsCounter = 0;
            console.log("Counter reset. Main request thread is free to respond.");
        }

        // إرسال استجابة ناجحة للمستخدم على الفور
        res.status(201).json({ success: true, message: 'شكرًا لك! تم استلام تقييمك.' });

    } catch (error) {
        console.error('❌ ERROR in /api/review endpoint (DB insert):', error);
        res.status(500).json({ success: false, message: 'خطأ فادح في السيرفر.' });
    }
});
// END OF FILE server.js
