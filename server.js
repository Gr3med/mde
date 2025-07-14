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

// دالة لإنشاء جدول التقييمات بالهيكل الجديد
async function setupDatabase() {
    console.log('Setting up database schema...');
    // حذف الجدول القديم إذا كان موجودًا لضمان تطبيق الهيكل الجديد (مهم عند التغيير)
    // تحذير: هذا سيحذف كل البيانات القديمة!
    await dbClient.query('DROP TABLE IF EXISTS reviews;');
    
    // إنشاء الجدول بالهيكل الجديد
    await dbClient.query(`
        CREATE TABLE reviews (
            id SERIAL PRIMARY KEY,
            "roomNumber" VARCHAR(50),
            reception INTEGER,
            cleanliness INTEGER,
            comfort INTEGER,
            facilities INTEGER,
            location INTEGER,
            value INTEGER,
            comments TEXT,
            "createdAt" TIMESTAMPTZ DEFAULT NOW()
        );
    `);
    console.log('✅ New database schema created successfully.');
}


app.listen(PORT, () => {
    console.log(`🚀 Server is listening on port ${PORT}`);
    dbClient.connect()
        .then(() => {
            console.log('✅ Connected to PostgreSQL DB.');
            // استدعاء دالة إعداد قاعدة البيانات
            return setupDatabase();
        })
        .then(() => {
            dbReady = true;
            console.log("✅ Database is ready to accept reviews.");
        })
        .catch(error => {
            console.error('❌ CRITICAL: DB Connection/Setup Failed:', error);
            // في حالة الفشل، حاول إعادة الاتصال بعد فترة
            setTimeout(() => app.listen(PORT, () => console.log('Retrying server start...')), 5000);
        });
});


async function generateAndSendReportInBackground() {
    console.log("⚙️ Starting background report generation with new format...");
    try {
        const statsRes = await dbClient.query(`
            SELECT 
                COUNT(id) as total_reviews,
                AVG(reception) as avg_reception,
                AVG(cleanliness) as avg_cleanliness,
                AVG(comfort) as avg_comfort,
                AVG(facilities) as avg_facilities,
                AVG(location) as avg_location,
                AVG(value) as avg_value
            FROM reviews
        `);
        const recentRes = await dbClient.query('SELECT * FROM reviews ORDER BY id DESC LIMIT 5');
        
        const stats = statsRes.rows[0];
        const recentReviews = recentRes.rows;

        const { pdfBuffer, htmlContent } = await createCumulativePdfReport(stats, recentReviews);
        
        const attachments = [{
            filename: `Hotel-Report-${new Date().toISOString().slice(0, 10)}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
        }];

        const emailSubject = `📊 تقرير تقييمات جديد (الإجمالي: ${stats.total_reviews})`;
        await sendReportEmail(emailSubject, htmlContent, attachments);
        console.log("✅ New format report sent successfully.");

    } catch (err) {
        console.error("❌ CRITICAL: Background report generation failed:", err);
    }
}

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

        if (newReviewsCounter >= 3) {
            console.log(`🚀 Triggering background report. Counter: ${newReviewsCounter}.`);
            generateAndSendReportInBackground();
            newReviewsCounter = 0;
        }

        res.status(201).json({ success: true, message: 'شكرًا لك! تم استلام تقييمك بنجاح.' });

    } catch (error) {
        console.error('❌ ERROR in /api/review endpoint:', error);
        res.status(500).json({ success: false, message: 'خطأ فادح في السيرفر.' });
    }
});
// END OF FILE server.js
