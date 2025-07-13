// START OF FILE server.js

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const { sendReportEmail } = require('./notifications.js'); // استيراد sendReportEmail
const { createCumulativePdfReport } = require('./pdfGenerator.js'); // استيراد الدالة الجديدة لإنشاء الـ PDF
const config = require('./config.js');

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
let newReviewsCounter = 0; //عداد التقييمات الجديدة

app.listen(PORT, () => {
    console.log(`🚀 Server is listening on port ${PORT}`);
    dbClient.connect()
        .then(() => {
            console.log('✅ Connected to PostgreSQL DB.');
            // التأكد من أن أسماء الأعمدة في قاعدة البيانات تستخدم "camelCase" لتتوافق مع الكود
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
        newReviewsCounter++; // زيادة العداد

        // إذا وصل العداد إلى 3 تقييمات أو أكثر، قم بإنشاء وإرسال التقرير
        if (newReviewsCounter >= 3) {
            console.log(`📬 Triggering report generation. Counter: ${newReviewsCounter}`);
            
            // جلب الإحصائيات الكلية
            const statsRes = await dbClient.query(`
                SELECT 
                    COUNT(id) as total_reviews, 
                    AVG(cleanliness) as avg_cleanliness, 
                    AVG(reception) as avg_reception, 
                    AVG(services) as avg_services 
                FROM reviews
            `);
            // جلب آخر 3 تقييمات
            const recentRes = await dbClient.query('SELECT * FROM reviews ORDER BY id DESC LIMIT 3');
            
            const stats = statsRes.rows[0];
            const recentReviews = recentRes.rows;
            
            // بناء محتوى HTML للتقرير (هذا المحتوى سيذهب في نص البريد الإلكتروني)
            let emailHtmlContent = `<div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6;"><h2>📊 تقرير تقييمات تراكمي</h2><p><strong>إجمالي التقييمات:</strong> ${stats.total_reviews}</p><p><strong>معدل النظافة:</strong> ${Number(stats.avg_cleanliness).toFixed(2)} / 5</p><p><strong>معدل الاستقبال:</strong> ${Number(stats.avg_reception).toFixed(2)} / 5</p><p><strong>معدل الخدمات:</strong> ${Number(stats.avg_services).toFixed(2)} / 5</p><hr><h3>آخر 3 تقييمات:</h3><ul>`;
            recentReviews.forEach(r => {
                emailHtmlContent += `<li><b>غرفة ${r.roomNumber}:</b> (نظافة: ${r.cleanliness}★) (استقبال: ${r.reception}★) (خدمات: ${r.services}★) - <em>${r.comments || 'لا تعليق'}</em></li>`;
            });
            emailHtmlContent += `</ul><p>تم إرفاق تقرير PDF احترافي بهذا البريد.</p></div>`;

            // اسم الموضوع للبريد الإلكتروني
            const emailSubject = `📊 تقرير تقييمات فوري (الإجمالي: ${stats.total_reviews})`;
            
            // إنشاء ملف PDF احترافي باستخدام الدالة الجديدة
            const pdfBuffer = await createCumulativePdfReport(stats, recentReviews);

            // إعداد المرفقات
            const attachments = [
                {
                    filename: `تقرير_تقييمات_فندق_ماريوت_${new Date().toISOString().slice(0, 10)}.pdf`, // اسم الملف
                    content: pdfBuffer, // محتوى الـ PDF كـ Buffer
                    contentType: 'application/pdf' // نوع المحتوى
                }
            ];

            // إرسال البريد الإلكتروني مع مرفق PDF
            await sendReportEmail(emailSubject, emailHtmlContent, attachments);
            
            newReviewsCounter = 0; // إعادة تعيين العداد بعد إرسال التقرير
        }

        res.status(201).json({ success: true, message: 'شكرًا لك! تم استلام تقييمك.' });
    } catch (error) {
        console.error('❌ ERROR in /api/review:', error);
        res.status(500).json({ success: false, message: 'خطأ فادح في السيرفر.' });
    }
});
// END OF FILE server.js