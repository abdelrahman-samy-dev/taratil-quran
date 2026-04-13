<div align="center">
  <img src="icons/icon.svg" width="120" height="120" alt="Taratil Logo">
  <h1>تراتيل (Taratil)</h1>
  <p><b>التطبيق الإسلامي الشامل والمتكامل - تجربة إيمانية بروح عصرية</b></p>
  
  <p>
    <a href="https://taratil-quran.vercel.app/" target="_blank">
      <img src="https://img.shields.io/badge/Live_Demo-Click_Here-blue.svg?style=for-the-badge" alt="Live Demo">
    </a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Open_Source-Yes-brightgreen.svg?style=flat-square" alt="Open Source">
    <img src="https://img.shields.io/badge/Version-3.0.0-success.svg?style=flat-square" alt="Version">
    <img src="https://img.shields.io/badge/PWA-Ready-blue.svg?style=flat-square" alt="PWA Ready">
    <img src="https://img.shields.io/badge/Made_by-Abdelrahman_Samy-gold.svg?style=flat-square" alt="Made by Abdelrahman Samy">
  </p>
</div>

---

## عن التطبيق (About)
**تراتيل** هو تطبيق ويب تقدمي (PWA) مفتوح المصدر يعتمد على أحدث تقنيات الويب لتقديم تجربة استثنائية وسلسة لقراءة القرآن الكريم والاستماع إليه، بالإضافة إلى أذكار المسلم اليومية والمزيد. صُمم التطبيق بأعلى معايير جودة الواجهات وتجربة المستخدم ليجمع بين الأصالة والأناقة العصرية، وتم تطويره وتصميمه بالكامل بواسطة **Abdelrahman Samy**.

## المميزات الرئيسية (Key Features)

### مصحف تراتيل (القارئ الذكي)
*   **جودة عالية الدقة:** قراءة القرآن الكريم من صفحات المصحف الأصلية (عثماني) بجودة وتفاصيل استثنائية.
*   **تتبع الورد اليومي (Werd Tracker):** نظام ذكي لتحديد وردك اليومي (عدد الصفحات) مع شريط تقدم تفاعلي لحساب ما قرأته، ودعم تخصيص أهداف القراءة بمرونة وموثوقية لحفظ التقدم التلقائي.
*   **الوضع الليلي המخصص:** أداة تحكم سلسة في إضاءة صفحات المصحف خصيصاً لحماية العين أثناء القراءة ليلاً.
*   **متصفح متقدم للمصحف:** قائمة منسدلة احترافية مصممة خصيصاً للبحث والانتقال السريع بين السور بأداء فائق السلاسة.
*   **علامات مرجعية متقدمة:** حفظ الصفحات للعودة إليها لاحقاً بتصنيفات مخصصة (حفظ، تدبر، مراجعة).

### المشغل الصوتي الاحترافي (Smart Audio Player)
*   **محرك مزامنة هجين (Sync Engine):** نظام مزامنة ذكي لتظليل النص القرآني بشكل متوافق تماماً مع تلاوة القارئ، دون الاعتماد على خدمات خارجية أو مدفوعة (Paid APIs).
*   **تجربة سينمائية مبهرة (Premium UI):** مشغل بكامل الشاشة يحتوي على أزرار تحكم ديناميكية واختيار دقيق بين مئات القراء المجودين في واجهة عصرية ومصقولة (Glassmorphism).

### أذكار المسلم (Premium Azkar)
*   **واجهة تفاعلية فاخرة:** تصميم بنظام "Glassmorphism" مع تصنيفات واضحة وجذابة لأذكار الصباح، المساء، ما بعد الصلاة وغيرها.
*   **عدّادات تقدم ذكية:** نظام تتبع (Counters) ذكي يوضح مدى التقدم في إتمام الذكر مع أشكال استجابة بالاهتزاز (Haptic feedback) وتنبيه مرئي ومسموع متزامن عند الانتهاء.

### تكنولوجيا PWA الحديثة (Offline First)
*   **تشغيل بلا إنترنت:** بفضل تقنيات الـ Service Workers، يعمل التطبيق بكامل طاقته (قراءة المصحف، تتبع الأذكار، إلخ) للمحتوى المحفوظ مسبقاً حتى في حالة عدم توفر اتصال بالإنترنت.
*   **قابلية التثبيت السريع:** يمكن تثبيته كتطبيق أصلي (Native App) على كافة أنظمة التشغيل (Android, iOS, Windows, macOS) بنقرة واحدة والتنقل بسلاسة عبره.

---

## التقنيات وهندسة البرمجيات (Tech Stack & Architecture)
تم تصميم وهندسة المشروع بأسلوب احترافي لضمان الأداء الأقصى والاستجابة السريعة، معتمدًا بشكل كامل على التقنيات الأساسية للويب (Vanilla) دون اللجوء إلى أطر عمل ضخمة (Zero-bundle size for frameworks)، مما يحقق سرعة تحميل خيالية.

*   **HTML5 / CSS3:** استخدام أحدث ممارسات CSS (Variables, Grid, Flexbox, Glassmorphism, Backdrop-filters) لبناء واجهة ديناميكية خفيفة الوزن.
*   **Vanilla JavaScript (ES6+):** هيكلة نموذجية وإدارة حالة شاملة تعتمد بالكامل على لغة جافاسكربت الأصلية لسرعة استجابة فائقة.
*   **PWA Architecture:** 
    *   `sw.js`: نظام متقدم للتخزين المؤقت وحفظ الموارد (Caching Strategies) مثل `Stale-while-revalidate` و `Cache-first` و `Network-first` لضمان استقرار التطبيق كليًا.
    *   `manifest.json`: لتعريف التطبيق وخصائصه وجعله قابلاً للتثبيت مباشرة.
*   **State Management:** استخدام `localStorage` بذكاء للحفاظ على إعدادات المستخدم، وحفظ مكان التوقف في المصحف، وتتبع تقدم الأذكار بشكل دائم.

### هيكلة المجلدات المحدثة
```text
📦 Taratil PWA
 ┣ 📂 css
 ┃ ┗ 📜 styles.css
 ┣ 📂 js
 ┃ ┣ 📜 app.js
 ┃ ┣ 📜 data.js
 ┃ ┣ 📜 mushaf.js
 ┃ ┗ 📜 sync-engine.js
 ┣ 📂 data
 ┃ ┗ 📜 adkar.json
 ┣ 📂 icons
 ┃ ┗ 📜 icon.svg
 ┣ 📂 scripts
 ┃ ┗ 📜 transform.js
 ┣ 📜 index.html
 ┣ 📜 sw.js
 ┗ 📜 manifest.json
```

---

## المطور (Developer)
صُنع بشغف وإتقان بواسطة:
**[Abdelrahman Samy]**

*   المهندس المعماري للواجهة وتجربة المستخدم (UI/UX).
*   مطور محرك التزامن (Sync Engine) ومطور النظام الخلفي للتطبيق (Service Workers).

---
> **ملاحظة:** مشروع "تراتيل" هو مشروع مفتوح المصدر (Open Source) تماماً. يمكنك مراجعة الكود، والمساهمة في تطويره، كما يمكنك استضافته بكل سهولة على أي خدمة لرفع الملفات الثابتة مثل GitHub Pages, Netlify, Vercel بمجرد رفع الملفات!
