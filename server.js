// START OF FILE server.js

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const { sendReportEmail, generatePdf } = require('./notifications.js'); // تغيير الاستيراد
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
            
            // بناء محتوى HTML للتقرير (نفس المحتوى المستخدم للبريد الإلكتروني النصي)
            let reportHtml = `
                <div dir="rtl" style="font-family: 'Tajawal', Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 600px; margin: auto;">
                    <h1 style="color: #003c71; text-align: center;">📊 تقرير تقييمات فندق ماريوت</h1>
                    <p style="text-align: center; color: #666;">تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}</p>
                    <hr style="border: none; border-top: 1px dashed #ddd; margin: 25px 0;">
                    
                    <h2 style="color: #003c71;">إحصائيات عامة</h2>
                    <p><strong>إجمالي التقييمات:</strong> <span style="color: #d4a75c; font-weight: bold;">${stats.total_reviews}</span></p>
                    <p><strong>متوسط تقييم النظافة:</strong> <span style="color: #d4a75c; font-weight: bold;">${Number(stats.avg_cleanliness).toFixed(2)} / 5</span></p>
                    <p><strong>متوسط تقييم الاستقبال:</strong> <span style="color: #d4a75c; font-weight: bold;">${Number(stats.avg_reception).toFixed(2)} / 5</span></p>
                    <p><strong>متوسط تقييم الخدمات:</strong> <span style="color: #d4a75c; font-weight: bold;">${Number(stats.avg_services).toFixed(2)} / 5</span></p>
                    
                    <hr style="border: none; border-top: 1px dashed #ddd; margin: 25px 0;">

                    <h2 style="color: #003c71;">آخر 3 تقييمات تم استلامها</h2>
                    <ul style="list-style: none; padding: 0;">`;
            recentReviews.forEach(r => {
                reportHtml += `
                    <li style="background-color: #f9f9f9; border: 1px solid #eee; border-radius: 5px; padding: 15px; margin-bottom: 10px;">
                        <p style="margin: 0 0 5px 0;"><b>رقم الغرفة:</b> ${r.roomNumber}</p>
                        <p style="margin: 0 0 5px 0;"><b>النظافة:</b> ${r.cleanliness}★ | <b>الاستقبال:</b> ${r.reception}★ | <b>الخدمات:</b> ${r.services}★</p>
                        <p style="margin: 0; font-style: italic; color: #555;">"${r.comments || 'لا يوجد تعليق'}"</p>
                        <p style="margin: 10px 0 0 0; font-size: 0.9em; color: #888;">تاريخ التقييم: ${new Date(r.createdAt).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}</p>
                    </li>`;
            });
            reportHtml += `</ul>
                    <hr style="border: none; border-top: 1px dashed #ddd; margin: 25px 0;">
                    <p style="text-align: center; font-size: 0.9em; color: #888;">شكراً لاستخدامك نظام تقييم فندق ماريوت.</p>
                </div>`;

            // اسم الموضوع للبريد الإلكتروني
            const emailSubject = `📊 تقرير تقييمات فوري (الإجمالي: ${stats.total_reviews})`;
            
            // إنشاء ملف PDF
            const pdfBuffer = await generatePdf(reportHtml);

            // إعداد المرفقات
            const attachments = [
                {
                    filename: `تقرير_تقييمات_${new Date().toISOString().slice(0, 10)}.pdf`, // اسم الملف
                    content: pdfBuffer, // محتوى الـ PDF كـ Buffer
                    contentType: 'application/pdf' // نوع المحتوى
                }
            ];

            // إرسال البريد الإلكتروني مع مرفق PDF
            await sendReportEmail(emailSubject, reportHtml, attachments);
            
            newReviewsCounter = 0; // إعادة تعيين العداد بعد إرسال التقرير
        }

        res.status(201).json({ success: true, message: 'شكرًا لك! تم استلام تقييمك.' });
    } catch (error) {
        console.error('❌ ERROR in /api/review:', error);
        res.status(500).json({ success: false, message: 'خطأ فادح في السيرفر.' });
    }
});
// END OF FILE server.js
