// START OF FILE server.js (VERSION WITH DETAILED LOGGING)

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

async function generateAndSendReportInBackground() {
    console.log("---"); // Separator for clarity in logs
    console.log("⚙️ [Step 1/5] Starting background report generation...");
    try {
        const statsRes = await dbClient.query(`SELECT COUNT(id) as total_reviews, AVG(cleanliness) as avg_cleanliness, AVG(reception) as avg_reception, AVG(services) as avg_services FROM reviews`);
        console.log("⚙️ [Step 2/5] Successfully fetched stats from DB.");
        
        const recentRes = await dbClient.query('SELECT * FROM reviews ORDER BY id DESC LIMIT 3');
        console.log("⚙️ [Step 3/5] Successfully fetched recent reviews from DB.");
        
        const stats = statsRes.rows[0];
        const recentReviews = recentRes.rows;

        console.log("⏳ [Step 4/5] Starting PDF generation (this is the memory-intensive part)...");
        const { pdfBuffer, htmlContent } = await createCumulativePdfReport(stats, recentReviews);
        console.log("✅ [Step 4.5/5] PDF generation completed successfully.");

        const attachments = [{
            filename: `تقرير_التقييمات_${new Date().toISOString().slice(0, 10)}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
        }];

        console.log("⏳ [Step 5/5] Sending email with attachment...");
        const emailSubject = `📊 تقرير تقييمات فوري (الإجمالي: ${stats.total_reviews})`;
        await sendReportEmail(emailSubject, htmlContent, attachments);
        
        console.log("🎉 SUCCESS: Background report and email sent.");
        console.log("---");

    } catch (err) {
        console.error("❌ CRITICAL: Background report generation failed. Error details below:");
        console.error(err);
        console.log("---");
    }
}

app.post('/api/review', async (req, res) => {
    if (!dbReady) {
        return res.status(503).json({ success: false, message: 'السيرفر غير جاهز حاليًا.' });
    }
    try {
        const { roomNumber, cleanliness, reception, services, comments } = req.body;
        await dbClient.query('INSERT INTO reviews ("roomNumber", cleanliness, reception, services, comments) VALUES ($1, $2, $3, $4, $5)', [roomNumber, cleanliness, reception, services, comments]);
        newReviewsCounter++;
        console.log(`Review received. Counter is now: ${newReviewsCounter}`);

        if (newReviewsCounter >= 3) {
            console.log(`🚀 Triggering background report generation. Counter is ${newReviewsCounter}.`);
            generateAndSendReportInBackground();
            newReviewsCounter = 0;
            console.log("Counter reset. Main thread is responding to user.");
        }
        res.status(201).json({ success: true, message: 'شكرًا لك! تم استلام تقييمك.' });
    } catch (error) {
        console.error('❌ ERROR in /api/review endpoint:', error);
        res.status(500).json({ success: false, message: 'خطأ فادح في السيرفر.' });
    }
});
// END OF FILE server.js
