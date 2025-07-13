// START OF FILE server.js

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

// استيراد الدوال من الملف الجديد
const { sendReportEmail, generatePdf } = require('./notifications.js');

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
let newReviewsCounter = 0; // عداد التقييمات الجديدة

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

app.post('/api/review', async (req, res) => {
    if (!dbReady) {
        return res.status(503).json({ success: false, message: 'السيرفر غير جاهز حاليًا.' });
    }
    try {
        const { roomNumber, cleanliness, reception, services, comments } = req.body;
        await dbClient.query('INSERT INTO reviews ("roomNumber", cleanliness, reception, services, comments) VALUES ($1, $2, $3, $4, $5)', [roomNumber, cleanliness, reception, services, comments]);
        
        newReviewsCounter++;
        console.log(`📝 New review received. Counter is now: ${newReviewsCounter}`);

        // إذا وصل العداد إلى 3 تقييمات أو أكثر، قم بإنشاء وإرسال التقرير
        if (newReviewsCounter >= 3) {
            console.log(`📬 Triggering report generation. Counter: ${newReviewsCounter}`);

            // 1. جلب البيانات من قاعدة البيانات
            const statsRes = await dbClient.query(`
                SELECT 
                    COUNT(id) as total_reviews, 
                    AVG(cleanliness) as avg_cleanliness, 
                    AVG(reception) as avg_reception, 
                    AVG(services) as avg_services 
                FROM reviews
            `);
            const recentRes = await dbClient.query('SELECT "roomNumber", cleanliness, reception, services, comments, "createdAt" FROM reviews ORDER BY id DESC LIMIT 3');
            
            const stats = statsRes.rows[0];
            const recentReviews = recentRes.rows;
            
            // 2. إنشاء ملف PDF الاحترافي
            console.log("⏳ Generating professional PDF...");
            const pdfBuffer = await generatePdf(stats, recentReviews);
            console.log("✅ Professional PDF generated.");

            // 3. إعداد البريد الإلكتروني والمرفقات
            const emailSubject = `📊 تقرير تقييمات فوري (الإجمالي: ${stats.total_reviews})`;
            // يمكن إنشاء نسخة HTML بسيطة للبريد الإلكتروني هنا إذا أردت
            const emailHtmlBody = `<p dir="rtl">مرحباً،<br><br>تجدون في المرفقات تقرير الأداء الجديد.<br><br>مع خالص التقدير،<br>نظام التقارير الآلي</p>`;
            
            const attachments = [{
                filename: `Marriott-Report-${new Date().toISOString().slice(0, 10)}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }];

            // 4. إرسال البريد الإلكتروني
            await sendReportEmail(emailSubject, emailHtmlBody, attachments);
            
            // 5. إعادة تعيين العداد
            console.log("🔄 Resetting review counter.");
            newReviewsCounter = 0; 
        }

        res.status(201).json({ success: true, message: 'شكرًا لك! تم استلام تقييمك.' });
    } catch (error) {
        console.error('❌ ERROR in /api/review:', error);
        res.status(500).json({ success: false, message: 'خطأ فادح في السيرفر.' });
    }
});
// END OF FILE server.js
