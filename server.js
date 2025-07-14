// START OF FILE server.js (WITH SCHEDULED TASKS)

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
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

// ------------------- دالة مركزية لإنشاء التقارير -------------------
// period: 'daily', 'weekly', 'monthly'
// title: 'التقرير اليومي', 'التقرير الأسبوعي', ...
// interval: '1 DAY', '7 DAY', '1 MONTH'
async function generateAndSendReport(period, title, interval) {
    console.log(`[${new Date().toISOString()}] 🚀 Starting generation for ${title}...`);
    try {
        const statsQuery = `
            SELECT 
                COUNT(id) as total_reviews,
                AVG(reception) as avg_reception,
                AVG(cleanliness) as avg_cleanliness,
                AVG(comfort) as avg_comfort,
                AVG(facilities) as avg_facilities,
                AVG(location) as avg_location,
                AVG(value) as avg_value
            FROM reviews
            WHERE "createdAt" >= NOW() - INTERVAL '${interval}'
        `;
        const recentReviewsQuery = `
            SELECT * FROM reviews 
            WHERE "createdAt" >= NOW() - INTERVAL '${interval}'
            ORDER BY id DESC
        `;
        
        const statsRes = await dbClient.query(statsQuery);
        const recentRes = await dbClient.query(recentReviewsQuery);

        const stats = statsRes.rows[0];
        const recentReviews = recentRes.rows;

        // إذا لم تكن هناك تقييمات في الفترة المحددة، لا ترسل التقرير
        if (stats.total_reviews == 0) {
            console.log(`ℹ️ No reviews found for the ${period} report. Skipping email.`);
            return;
        }

        // إنشاء PDF ومحتوى HTML
        const { pdfBuffer, htmlContent } = await createCumulativePdfReport(stats, recentReviews);
        
        const attachments = [{
            filename: `${period}-report-${new Date().toISOString().slice(0, 10)}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
        }];

        const emailSubject = `📊 ${title} لتقييمات الفندق (${stats.total_reviews} تقييم)`;
        await sendReportEmail(emailSubject, htmlContent, attachments);
        console.log(`✅ ${title} sent successfully.`);

    } catch (err) {
        console.error(`❌ CRITICAL: Failed to generate ${title}:`, err);
    }
}


// ------------------- إعداد المهام المجدولة -------------------
function setupScheduledTasks() {
    // مهم: التوقيتات بتنسيق UTC. سيرفرات Render تعمل بـ UTC.
    
    // 1. التقرير اليومي: كل يوم في الساعة 11:55 مساءً بتوقيت UTC
    // (يجمع بيانات آخر 24 ساعة)
    cron.schedule('55 23 * * *', () => {
        generateAndSendReport('daily', 'التقرير اليومي', '1 DAY');
    }, {
        timezone: "Etc/UTC"
    });

    // 2. التقرير الأسبوعي: كل يوم أحد في الساعة 11:50 مساءً بتوقيت UTC
    // (يجمع بيانات آخر 7 أيام)
    cron.schedule('50 23 * * 0', () => {
        generateAndSendReport('weekly', 'التقرير الأسبوعي', '7 DAY');
    }, {
        timezone: "Etc/UTC"
    });

    // 3. التقرير الشهري: في اليوم الأول من كل شهر في الساعة 11:45 مساءً بتوقيت UTC
    // (يجمع بيانات آخر شهر)
    cron.schedule('45 23 1 * *', () => {
        generateAndSendReport('monthly', 'التقرير الشهري', '1 MONTH');
    }, {
        timezone: "Etc/UTC"
    });

    console.log('✅ Scheduled tasks (daily, weekly, monthly) are set up.');
}


// ------------------- تشغيل السيرفر وقاعدة البيانات -------------------
app.listen(PORT, () => {
    console.log(`🚀 Server is listening on port ${PORT}`);
    dbClient.connect()
        .then(async () => {
            console.log('✅ Connected to PostgreSQL DB.');
            // التأكد من وجود الجدول، ولكن لا نحذف البيانات
            await dbClient.query(`
                CREATE TABLE IF NOT EXISTS reviews (
                    id SERIAL PRIMARY KEY, "roomNumber" VARCHAR(50), reception INTEGER,
                    cleanliness INTEGER, comfort INTEGER, facilities INTEGER, location INTEGER,
                    value INTEGER, comments TEXT, "createdAt" TIMESTAMPTZ DEFAULT NOW()
                );
            `);
            dbReady = true;
            console.log("✅ Database is ready.");
            // إعداد المهام المجدولة بعد التأكد من جاهزية كل شيء
            setupScheduledTasks();
        })
        .catch(error => {
            console.error('❌ CRITICAL: DB Connection/Setup Failed:', error);
        });
});

// ------------------- نقطة النهاية لاستقبال التقييمات -------------------
// تم إزالة عداد التقييمات. الآن يتم فقط حفظ البيانات.
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

        // تم إرسال الرد بنجاح، والتقارير ستُرسل لاحقًا بشكل مجدول
        res.status(201).json({ success: true, message: 'شكرًا لك! تم استلام تقييمك بنجاح.' });

    } catch (error) {
        console.error('❌ ERROR in /api/review endpoint:', error);
        res.status(500).json({ success: false, message: 'خطأ فادح في السيرفر.' });
    }
});
// END OF FILE server.js
