// START OF FILE server.js (PANORAMA FIELDS - TESTING VERSION)

const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
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
    console.log('Setting up new database schema for Panorama Hotel...');
    await dbClient.query('DROP TABLE IF EXISTS reviews;');
    await dbClient.query(`
        CREATE TABLE reviews (
            id SERIAL PRIMARY KEY,
            date VARCHAR(50),
            "roomNumber" VARCHAR(50),
            "guestName" TEXT,
            "guestPhone" VARCHAR(50),
            internet INTEGER,
            maintenance INTEGER,
            reception INTEGER,
            bathroom INTEGER,
            laundry INTEGER,
            security INTEGER,
            minimarket INTEGER,
            lobby INTEGER,
            restaurant INTEGER,
            cleanliness INTEGER,
            "howDidYouHear" TEXT,
            suggestions TEXT,
            "createdAt" TIMESTAMPTZ DEFAULT NOW()
        );
    `);
    console.log('✅ New Panorama Hotel schema created successfully.');
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
    console.log("--- Starting Test Report Generation for Panorama Hotel ---");
    try {
        const statsQuery = `
            SELECT 
                COUNT(id) as total_reviews,
                AVG(internet) as avg_internet, AVG(maintenance) as avg_maintenance,
                AVG(reception) as avg_reception, AVG(bathroom) as avg_bathroom,
                AVG(laundry) as avg_laundry, AVG(security) as avg_security,
                AVG(minimarket) as avg_minimarket, AVG(lobby) as avg_lobby,
                AVG(restaurant) as avg_restaurant, AVG(cleanliness) as avg_cleanliness
            FROM reviews WHERE id IN (SELECT id FROM reviews ORDER BY id DESC LIMIT 5)
        `;
        const recentReviewsQuery = `SELECT * FROM reviews ORDER BY id DESC LIMIT 5`;
        
        const statsRes = await dbClient.query(statsQuery);
        const recentRes = await dbClient.query(recentReviewsQuery);

        const stats = statsRes.rows[0];
        const recentReviews = recentRes.rows;

        if (!stats || stats.total_reviews == 0) return;
        
        const logoPath = path.join(__dirname, 'logo.jpg');
        const logoBase64 = fs.readFileSync(logoPath).toString('base64');
        const logoDataUri = `data:image/jpeg;base64,${logoBase64}`;

        const { pdfBuffer, emailHtmlContent } = await createCumulativePdfReport(stats, recentReviews, logoDataUri);
        
        const attachments = [{
            filename: `Hotel-Report-${new Date().toISOString().slice(0, 10)}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
        }];

        const emailSubject = `📊 [تجريبي] تقرير استبيان الفندق (${stats.total_reviews} تقييم)`;
        await sendReportEmail(emailSubject, emailHtmlContent, attachments);
        console.log(`[TEST RUN] ✅ Hotel report sent successfully.`);

    } catch (err) {
        console.error(`[TEST RUN] ❌ CRITICAL: Failed to generate report:`, err);
    }
}

app.post('/api/review', async (req, res) => {
    if (!dbReady) return res.status(503).json({ success: false, message: 'السيرفر غير جاهز حاليًا.' });
    
    try {
        const {
            date, roomNumber, guestName, guestPhone,
            internet, maintenance, reception, bathroom, laundry, security,
            minimarket, lobby, restaurant, cleanliness,
            howDidYouHear, suggestions
        } = req.body;
        
        const query = {
            text: `INSERT INTO reviews(
                date, "roomNumber", "guestName", "guestPhone", internet, maintenance, reception, bathroom,
                laundry, security, minimarket, lobby, restaurant, cleanliness, "howDidYouHear", suggestions
            ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
            values: [
                date, roomNumber, guestName, guestPhone, internet, maintenance, reception, bathroom,
                laundry, security, minimarket, lobby, restaurant, cleanliness, howDidYouHear, suggestions
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
