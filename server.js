// START OF FILE server.js (TESTING VERSION - WITH CORRECT EMAIL BODY)

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
const REVIEWS_THRESHOLD = 3;

async function generateAndSendReport(period, title) {
    console.log(`[TEST RUN] 🚀 Starting generation for ${title}...`);
    try {
        const recentReviewsQuery = `SELECT * FROM reviews ORDER BY id DESC LIMIT 5`;
        const statsQuery = `
            WITH recent_reviews AS (SELECT * FROM reviews ORDER BY id DESC LIMIT 5)
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

        // *** التغيير المهم ***
        // الآن نستقبل نسختين من الـ HTML
        const { pdfBuffer, emailHtmlContent } = await createCumulativePdfReport(stats, recentReviews);
        
        const attachments = [{
            filename: `TEST-${period}-report-${new Date().toISOString().slice(0, 10)}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
        }];

        const emailSubject = `📊 [تجريبي] ${title} (${stats.total_reviews} تقييم)`;
        
        // *** التغيير المهم ***
        // نرسل النسخة المبسطة في متن البريد الإلكتروني
        await sendReportEmail(emailSubject, emailHtmlContent, attachments);
        console.log(`[TEST RUN] ✅ ${title} sent successfully.`);

    } catch (err) {
        console.error(`[TEST RUN] ❌ CRITICAL: Failed to generate ${title}:`, err);
    }
}

async function runAllTestReports() {
    console.log("--- Starting Test Report Generation ---");
    await generateAndSendReport('daily', 'التقرير اليومي');
    await generateAndSendReport('weekly', 'التقرير الأسبوعي');
    await generateAndSendReport('monthly', 'التقرير الشهري');
    console.log("--- Finished Test Report Generation ---");
}

// ... (بقية كود تشغيل السيرفر كما هو) ...
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

        if (newReviewsCounter >= REVIEWS_THRESHOLD) {
            console.log(`🚀 Threshold reached! Triggering all test reports.`);
            runAllTestReports();
            newReviewsCounter = 0;
            console.log("Counter reset. Main thread responding to user.");
        }
        res.status(201).json({ success: true, message: 'شكرًا لك! تم استلام تقييمك بنجاح.' });
    } catch (error) {
        console.error('❌ ERROR in /api/review endpoint:', error);
        res.status(500).json({ success: false, message: 'خطأ فادح في السيرفر.' });
    }
});
