// START OF FILE server.js (FINAL ROOMS & SUITES SCHEMA - TESTING VERSION)

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
const REVIEWS_THRESHOLD = 3; // إرسال التقرير بعد 3 تقييمات للتجربة

async function setupDatabase() {
    console.log('Setting up new database schema for Rooms & Suites...');
    await dbClient.query('DROP TABLE IF EXISTS reviews;');
    await dbClient.query(`
        CREATE TABLE reviews (
            id SERIAL PRIMARY KEY,
            date VARCHAR(50),
            guestName TEXT,
            floor INTEGER,
            roomNumber INTEGER,
            email TEXT,
            mobileNumber VARCHAR(50),
            cleanliness INTEGER,
            maintenance INTEGER,
            reception INTEGER,
            bathroom INTEGER,
            laundry INTEGER,
            security INTEGER,
            halls INTEGER,
            restaurant INTEGER,
            comments TEXT,
            "createdAt" TIMESTAMPTZ DEFAULT NOW()
        );
    `);
    console.log('✅ New Rooms & Suites schema created successfully.');
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
    console.log("--- Starting Test Report Generation for Rooms & Suites ---");
    try {
        const statsQuery = `
            SELECT 
                COUNT(id) as total_reviews,
                AVG(cleanliness) as avg_cleanliness, AVG(maintenance) as avg_maintenance,
                AVG(reception) as avg_reception, AVG(bathroom) as avg_bathroom,
                AVG(laundry) as avg_laundry, AVG(security) as avg_security,
                AVG(halls) as avg_halls, AVG(restaurant) as avg_restaurant
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
            filename: `Rooms-Suites-Report-${new Date().toISOString().slice(0, 10)}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
        }];

        const emailSubject = `📊 [تجريبي] تقرير استبيان الغرف والأجنحة (${stats.total_reviews} تقييم)`;
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
            date, guestName, floor, roomNumber, email, mobileNumber,
            cleanliness, maintenance, reception, bathroom, laundry,
            security, halls, restaurant, comments, countryCode
        } = req.body;

        // دمج مفتاح الدولة مع الرقم فقط إذا كان الرقم موجوداً
        let fullMobileNumber = mobileNumber ? `${countryCode || ''}${mobileNumber}` : null;
        
        const query = {
            text: `INSERT INTO reviews(
                date, guestName, floor, roomNumber, email, mobileNumber,
                cleanliness, maintenance, reception, bathroom, laundry,
                security, halls, restaurant, comments
            ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            values: [
                date, guestName, floor, roomNumber, email, fullMobileNumber,
                cleanliness, maintenance, reception, bathroom, laundry,
                security, halls, restaurant, comments
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