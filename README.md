<div align="center">
  <img src="public/icons/icon.svg" width="112" height="112" alt="Taratil logo">
  <h1>تراتيل · Taratil</h1>
  <p>
    <a href="https://taratil-quran.vercel.app/"><img src="https://img.shields.io/badge/Open_the_app-taratil--quran.vercel.app-059669?style=for-the-badge" alt="Open the app"></a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/version-4.0.0-059669?style=flat-square" alt="Version 4.0.0">
    <img src="https://img.shields.io/badge/PWA-offline_ready-0ea5e9?style=flat-square" alt="PWA">
    <img src="https://img.shields.io/badge/price-free-brightgreen?style=flat-square" alt="Free">
    <img src="https://img.shields.io/badge/made_by-Abdelrahman_Samy-d97706?style=flat-square" alt="Made by Abdelrahman Samy">
  </p>
</div>

<div dir="rtl" align="right">

<p align="center"><b>مصحف المدينة، تلاوات مع تظليل الآية، التفسير، الأذكار، مواقيت الصلاة والقبلة<br>في تطبيق واحد خفيف يعمل بدون إنترنت</b></p>

<p align="center">
تراتيل مجاني بالكامل، بلا إعلانات ولا اشتراكات ولا تسجيل دخول.<br>
نسأل الله أن يجعله صدقة جارية عنّا وعن جميع المسلمين، الأحياء منهم والأموات.
</p>

## المميزات

### المصحف

- **خط مصحف المدينة الأصلي** (طبعة مجمع الملك فهد) بدل الصور: حاد في أي حجم، وخفيف، ويتلوّن مع الوضع الليلي.
- صفحتان متجاورتان على الشاشات العريضة كالمصحف المطبوع، والسحب لتقليب الصفحات على الجوال.
- اضغط على أي آية لتستمع منها، أو تكررها للحفظ، أو تقرأ تفسيرها، أو تنسخها وتشاركها، أو تحفظ عليها علامة.
- **متابعة التلاوة:** الآية التي يقرؤها القارئ تُظلَّل والصفحات تتقلب معه.
- فهرس للسور والأجزاء والعلامات، وألوان ورقية مريحة مع تعتيم للقراءة الليلية.
- **ورد حقيقي:** الصفحة تُحسب مقروءة بعد بقائك عليها، لا بمجرد فتحها.

### الاستماع

- أكثر من ٢٠٠ قارئ وروايات متعددة.
- **تظليل دقيق للآيات** لأكثر من ١٠٠ تلاوة برواية حفص من مواضع الآيات في التسجيل نفسه.
- المشغّل يعرض صفحة المصحف نفسها والآية المتلوّة مظلّلة.
- التحكم من شاشة القفل والسماعات، سرعات التلاوة، تكرار السورة أو الآية، ومؤقت نوم.
- **تحميل السور للاستماع بدون إنترنت**، ومتابعة الاستماع من حيث توقفت.

### وأيضًا

- **التفسير ووضع التسميع** (الميسر، الجلالين، القرطبي، البغوي، الوسيط، التحرير والتنوير).
- **البحث في القرآن** بالكلمة أو باسم السورة ورقم الآية.
- **الأذكار** بعدّاد لكل ذكر، والآيات فيها بنص المصحف وخطه، و**السبحة** مع تسبيح ما بعد الصلاة.
- **مواقيت الصلاة تُحسب على جهازك** وتعمل بدون إنترنت، و**اتجاه القبلة** بالبوصلة.
- **إذاعات القرآن** المباشرة، و**الأحاديث** من كتب السنة مع البحث داخل الكتاب.
- **الورد والختمة:** هدف يومي، خطة ختمة، أيام متتالية، رسوم بيانية، وإنجازات.
- نسخة احتياطية لبياناتك، وثلاثة أوضاع للمظهر: فاتح، داكن، وأسود.
- بيانات مستخدمي الإصدار السابق (العلامات، آخر صفحة، الورد، الإعدادات) تُنقل تلقائيًا عند التحديث.

## مصادر البيانات

- نص القرآن وخطوط صفحات المصحف: [Quran.com](https://quran.com) و[مجمع الملك فهد لطباعة المصحف الشريف](https://qurancomplex.gov.sa).
- التلاوات ومواضع الآيات والإذاعات: [mp3quran.net](https://mp3quran.net).
- التفاسير: [alquran.cloud](https://alquran.cloud).
- الأحاديث: [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api).
- البحث عن المدن: [Open-Meteo](https://open-meteo.com).

## المطوّر

صُنع بواسطة **Abdelrahman Samy**. المشروع مفتوح المصدر، والمساهمات مرحّب بها.
لا تنسونا من صالح دعائكم.

</div>

---

## For developers

| Part | Choice |
| --- | --- |
| UI | [Preact](https://preactjs.com) + [Signals](https://preactjs.com/guide/v10/signals) + TypeScript (strict) |
| Build | [Vite](https://vite.dev), one lazy-loaded chunk per screen |
| Offline | Service worker with Workbox (`src/sw.ts`) |
| Prayer times & qibla | [adhan-js](https://github.com/batoulapps/adhan-js) |
| Tests | Vitest (logic) + Playwright (browser, on the production build) |

```text
src/
  app.tsx              routes (every screen is lazy-loaded)
  layout/              shell: sidebar, bottom bar, mini and full player
  audio/               audio engine, reciters, verse timings, offline downloads
  quran/               Quran data access (surahs, text, mushaf pages)
  state/               preferences, reading progress and werd
  lib/                 storage (+ one-time v3 migration), Arabic, formatting, network
  features/<screen>/   one folder per screen with its components and styles
  ui/                  shared components (sheets, icons, controls)
  sw.ts                service worker
public/data/           static data: text per surah, search index, 604 mushaf page layouts
scripts/               data and icon generators
tests/                 unit (Vitest) and e2e (Playwright)
```

```bash
npm install
npm run dev          # http://localhost:5180
npm test             # unit tests
npm run build        # production build in dist/
npm run e2e          # browser tests against the production build
npm run data:quran   # regenerate Quran data from the Quran.com API (not needed at runtime)
npm run icons        # regenerate app icons from public/icons/icon.svg
```

Deployed on Vercel (`vercel.json`): it builds the project and rewrites app routes to `index.html`.
