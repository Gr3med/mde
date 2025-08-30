// START OF FILE server.js (WITH FLOOR/ROOM SCHEMA - TESTING VERSION)

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

async function setupDatabase() {
    console.log('Setting up new database schema with Floor/Room...');
    await dbClient.query('DROP TABLE IF EXISTS reviews;');
    await dbClient.query(`
        CREATE TABLE reviews (
            id SERIAL PRIMARY KEY,
            "eventDate" VARCHAR(50),
            "coordinatorName" TEXT,
            floor INTEGER,
            "roomNumber" INTEGER,
            cleanliness INTEGER,
            lighting INTEGER,
            "acCooling" INTEGER,
            "roomService" INTEGER,
            "foodQuality" INTEGER,
            "internetService" INTEGER,
            "overallExperience" INTEGER,
            comments TEXT,
            "createdAt" TIMESTAMPTZ DEFAULT NOW()
        );
    `);
    console.log('✅ New Floor/Room schema created successfully.');
}

app.listen(PORT, () => {
    console.log(`🚀 Server is listening on port ${PORT}`);
    dbClient.connect()
        .then(() => {
            console.log('✅ Connected to PostgreSQL DB.');
            return setupDatabase();
        })
        .then(() => {
            dbReady = true;
            console.log("✅ Database is ready for TESTING MODE.");
        })
        .catch(error => console.error('❌ CRITICAL: DB Connection/Setup Failed:', error));
});

async function runAllTestReports() {
    console.log("--- Starting Test Report Generation ---");
    try {
        const statsQuery = `
            SELECT 
                COUNT(id) as total_reviews,
                AVG(cleanliness) as avg_cleanliness, AVG(lighting) as avg_lighting,
                AVG("acCooling") as avg_acCooling, AVG("roomService") as avg_roomService,
                AVG("foodQuality") as avg_foodQuality, AVG("internetService") as avg_internetService,
                AVG("overallExperience") as avg_overallExperience
            FROM reviews
            WHERE id IN (SELECT id FROM reviews ORDER BY id DESC LIMIT 5)
        `;
        const recentReviewsQuery = `SELECT * FROM reviews ORDER BY id DESC LIMIT 5`;
        
        const statsRes = await dbClient.query(statsQuery);
        const recentRes = await dbClient.query(recentReviewsQuery);

        const stats = statsRes.rows[0];
        const recentReviews = recentRes.rows;

        if (!stats || stats.total_reviews == 0) return;

        const { pdfBuffer, emailHtmlContent } = await createCumulativePdfReport(stats, recentReviews);
        
        const attachments = [{
            filename: `Hotel-Services-Report-${new Date().toISOString().slice(0, 10)}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
        }];

        const emailSubject = `📊 [تجريبي] تقرير تقييمات الفندق (${stats.total_reviews} تقييم)`;
        await sendReportEmail(emailSubject, emailHtmlContent, attachments);
        console.log(`[TEST RUN] ✅ Report sent successfully.`);

    } catch (err) {
        console.error(`[TEST RUN] ❌ CRITICAL: Failed to generate report:`, err);
    }
}

app.post('/api/review', async (req, res) => {
    if (!dbReady) return res.status(503).json({ success: false, message: 'السيرفر غير جاهز حاليًا.' });
    
    try {
        const {
            eventDate, coordinatorName, floor, roomNumber,
            cleanliness, lighting, acCooling, roomService, foodQuality,
            internetService, overallExperience, comments
        } = req.body;
        
        const query = {
            text: `INSERT INTO reviews(
                "eventDate", "coordinatorName", floor, "roomNumber", cleanliness, 
                lighting, "acCooling", "roomService", "foodQuality", 
                "internetService", "overallExperience", comments
            ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            values: [
                eventDate, coordinatorName, floor, roomNumber, cleanliness,
                lighting, acCooling, roomService, foodQuality,
                internetService, overallExperience, comments
            ],
        };
        
        await dbClient.query(query);
        newReviewsCounter++;
        console.log(`Review received. Counter: ${newReviewsCounter}/${REVIEWS_THRESHOLD}`);

        if (newReviewsCounter >= REVIEWS_THRESHOLD) {
            console.log(`🚀 Threshold reached! Triggering test report.`);
            runAllTestReports(); 
            newReviewsCounter = 0;
            console.log("Counter reset.");
        }
        res.status(201).json({ success: true, message: 'شكرًا لك! تم استلام تقييمك بنجاح.' });
    } catch (error) {
        console.error('❌ ERROR in /api/review endpoint:', error);
        res.status(500).json({ success: false, message: 'خطأ فادح في السيرفر.' });
    }
});