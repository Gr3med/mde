# استخدم صورة Node.js رسمية كقاعدة، اختر الإصدار الذي تفضله (مثل 20-slim)
FROM node:20-slim

# قم بتحديث قوائم apt وتثبيت متصفح Chromium والمكتبات الضرورية لـ Puppeteer
# المكتبات هنا مأخوذة من متطلبات تشغيل Puppeteer على Linux
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        fonts-liberation \
        libappindicator3-1 \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libexpat1 \
        libfontconfig1 \
        libgbm1 \
        libgcc1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libstdc++6 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxrandr2 \
        libxrender1 \
        libxshmfence1 \
        libxss1 \
        libxtst6 \
        lsb-release \
        wget \
        xdg-utils \
        # قد تحتاج أيضًا إلى إضافة حزمة chromium-browser نفسها إذا لم يتم تنزيلها بواسطة Puppeteer تلقائيًا
        # ولكن عادةً ما يقوم Puppeteer بتنزيلها بنفسه إذا تم توفير هذه المكتبات الأساسية
    && rm -rf /var/lib/apt/lists/* # تنظيف ملفات الـ apt المؤقتة لتقليل حجم الصورة

# تعيين دليل العمل داخل الحاوية
WORKDIR /usr/src/app

# نسخ ملفات تعريف التبعيات (package.json و package-lock.json) أولاً
# هذا يسمح لـ Docker بتخزين هذه الطبقة مؤقتًا إذا لم تتغير التبعيات
COPY package*.json ./

# تثبيت تبعيات Node.js
RUN npm install

# نسخ بقية ملفات التطبيق
COPY . .

# تعريف المنفذ الذي سيستمع إليه التطبيق (يجب أن يتوافق مع PORT في server.js)
EXPOSE 3000

# أمر بدء تشغيل التطبيق
CMD [ "node", "server.js" ]
