<div align="center">

![OpenYida](https://img.alicdn.com/imgextra/i4/O1CN017uyK3q1UUfbv7Z8oh_!!6000000002521-2-tps-2648-1382.png)

# 🚀 OpenYida

> *"We are on the verge of the Singularity"* — Vernor Vinge

**بناء تطبيقات Yida منخفضة الكود بالذكاء الاصطناعي — بدون إعداد، نشر فوري.**

[البدء](#البدء) · [أوامر CLI](#أوامر-cli) · [عرض توضيحي](#عرض-توضيحي) · [المساهمة](./CONTRIBUTING.md) · [سجل التغييرات](./CHANGELOG.md)

[![npm version](https://img.shields.io/npm/v/openyida?color=brightgreen&label=npm)](https://www.npmjs.com/package/openyida)
[![npm downloads](https://img.shields.io/npm/dm/openyida?color=blue)](https://www.npmjs.com/package/openyida)
[![CI](https://github.com/openyida/openyida/actions/workflows/ci.yml/badge.svg)](https://github.com/openyida/openyida/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js ≥18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

**اللغات:**
[English](./README.md) · [简体中文](./README.zh-CN.md) · [繁體中文（台灣）](./README.zh-TW.md) · [繁體中文（香港）](./README.zh-HK.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português (BR)](./README.pt-BR.md) · [Tiếng Việt](./README.vi.md) · [हिन्दी](./README.hi.md) · [العربية](./README.ar.md)

</div>

---

## البدء

```bash
npm install -g openyida
```

**بدون إعداد، جاهز للاستخدام فور التثبيت.** بعد التثبيت، تحدث مباشرة في Claude Code / OpenCode / Aone Copilot:

```
أنشئ لي نظام IPD على Yida لإدارة دورة إنتاج الرقائق الإلكترونية بالكامل
ابنِ لي نظام CRM
أنشئ تطبيق حاسبة الراتب الشخصي
```

---

## أدوات الذكاء الاصطناعي المدعومة

| الأداة | الحالة |
|--------|--------|
| [Claude Code](https://claude.ai/code) | ✅ دعم كامل |
| [Aone Copilot](https://copilot.code.alibaba-inc.com) | ✅ دعم كامل |
| [OpenCode](https://opencode.ai) | ✅ دعم كامل |
| [Cursor](https://cursor.com/) | ✅ دعم كامل |
| [Visual Studio Code](https://code.visualstudio.com/) | ✅ دعم كامل |
| [Qoder](https://qoder.com) | ✅ دعم كامل |
| [Wukong](https://dingtalk.com/wukong) | ✅ دعم كامل |

---

## الفرق عن منصات بناء التطبيقات الأخرى بالذكاء الاصطناعي

| البُعد | OpenYida | منصات أخرى |
|--------|----------|------------|
| المستخدمون المستهدفون | المطورون (من يعرفون البرمجة) | مستخدمو الأعمال (غير المطورين) |
| التفاعل | اللغة الطبيعية + محادثة الذكاء الاصطناعي | سحب وإفلات مرئي |
| المخرجات | تطبيق Yida (قابل للتحرير، قدرات low-code كاملة) | إعدادات (تنفيذ صندوق أسود) |
| النشر | منصة Yida | مقيّد بمنصة SaaS |
| نموذج الذكاء الاصطناعي | اختر أفضل نموذج بحرية | محدد من المنصة |
| الأمان | أمان Yida على مستوى المؤسسات | يعتمد على المنصة |

---

## المتطلبات

| التبعية | الإصدار | الغرض |
|---------|---------|-------|
| Node.js | ≥ 18 | تشغيل CLI ونشر الصفحات |

---

## أوامر CLI

```bash
openyida append-chart         # إضافة رسم بياني إلى تقرير موجود
openyida auth                 # إدارة حالة تسجيل الدخول (status/login/refresh/logout)
openyida cdn-config           # إعداد رفع الصور إلى CDN (Aliyun OSS + CDN)
openyida cdn-refresh          # تحديث ذاكرة CDN المؤقتة
openyida cdn-upload           # رفع الصور إلى CDN
openyida configure-process    # تكوين ونشر قواعد العملية
openyida connector            # إدارة موصل HTTP
openyida copy                 # تهيئة دليل project لأداة الذكاء الاصطناعي الحالية
openyida create-app           # إنشاء تطبيق Yida
openyida create-form          # إنشاء / تحديث صفحة نموذج
openyida create-page          # إنشاء صفحة عرض مخصصة
openyida create-process       # إنشاء نموذج عملية (متكامل)
openyida create-report        # إنشاء تقرير Yida
openyida data                 # إدارة البيانات الموحدة (نموذج/عملية/مهمة/نموذج فرعي)
openyida doctor               # تشخيص البيئة والإصلاح التلقائي
openyida env                  # اكتشاف بيئة أداة الذكاء الاصطناعي الحالية وحالة تسجيل الدخول
openyida export               # تصدير حزمة ترحيل التطبيق
openyida get-page-config      # الاستعلام عن إعدادات الوصول العام / المشاركة لصفحة
openyida get-permission       # الاستعلام عن إعدادات أذونات النموذج
openyida get-schema           # جلب مخطط النموذج
openyida import               # استيراد حزمة الترحيل لإعادة بناء التطبيق
openyida login                # تسجيل الدخول إلى Yida (الذاكرة المؤقتة أولاً، وإلا رمز QR)
openyida logout               # تسجيل الخروج / تبديل الحساب
openyida org                  # إدارة المنظمة (list/switch)
openyida publish              # تجميع ونشر صفحة مخصصة
openyida query-data           # الاستعلام عن بيانات نموذج النماذج
openyida save-permission      # حفظ إعدادات أذونات النموذج
openyida save-share-config    # حفظ إعدادات الوصول العام / المشاركة
openyida update-form-config   # تحديث إعدادات النموذج
openyida verify-short-url     # التحقق من إمكانية الوصول إلى رابط مختصر
```

---

## عرض توضيحي

### 🏢 أنظمة الأعمال — IPD / CRM

صِف متطلباتك في جملة واحدة — يقوم الذكاء الاصطناعي تلقائياً بإنشاء نظام أعمال متعدد النماذج بالكامل.

![IPD](https://img.alicdn.com/imgextra/i2/O1CN01YBEMa929J7sD9v8U1_!!6000000008046-2-tps-3840-3366.png)

![CRM](https://img.alicdn.com/imgextra/i3/O1CN01kn0Vcn1H5OkbQaizA_!!6000000000706-2-tps-3840-2168.png)

### 💰 أدوات مساعدة — حاسبة الراتب الشخصي

![حاسبة الراتب](https://gw.alicdn.com/imgextra/i2/O1CN017TeJuE1reVH2Dj7b7_!!6000000005656-2-tps-5114-2468.png)

### 🌐 صفحة هبوط — التعاون المؤسسي

أنشئ صفحة هبوط منتج مؤسسي كاملة من جملة واحدة فقط.

![التعاون المؤسسي](https://gw.alicdn.com/imgextra/i1/O1CN01EZtvfs1cxXV00UaXi_!!6000000003667-2-tps-5118-2470.png)

### 🏮 حملات — لعبة تخمين ألغاز الفوانيس

يولّد الذكاء الاصطناعي صور الألغاز، يخمّن المستخدمون الإجابات مع ردود فكاهية من الذكاء الاصطناعي عند الخطأ.

![لعبة تخمين الألغاز](https://img.alicdn.com/imgextra/i3/O1CN01dCoscP25jSAtAB9o3_!!6000000007562-2-tps-2144-1156.png)

---

## الأوامر الشائعة

```
ابنِ لي تطبيق [xxx]
أنشئ تطبيقاً من وثيقة المتطلبات هذه
أنشئ صفحة نموذج [xxx]
أضف حقل [xxx] إلى صفحة [xxx]، اسم الحقل: [الاسم]، النوع: [النوع]
اجعل حقل [xxx] في صفحة [xxx] إلزامياً
انشر صفحة [xxx]
اجعل الصفحة متاحة للعموم
تسجيل الدخول مجدداً / تسجيل الخروج
```

---

## التكامل مع OpenClaw

استخدم عبر [yida-app](https://clawhub.ai/nicky1108/yida-app) في OpenClaw:

```bash
npx clawhub@latest install nicky1108/yida-app
```

---

## المجتمع

امسح رمز QR للانضمام إلى مجموعة مستخدمي OpenYida على DingTalk.

![انضم إلى مجتمع OpenYida](https://img.alicdn.com/imgextra/i4/O1CN01RAlxmO1qF1cxRguyj_!!6000000005465-2-tps-350-356.png)

---

## المساهمون

شكراً لجميع من ساهموا في OpenYida! اقرأ [دليل المساهمة](./CONTRIBUTING.md) للمشاركة.

<p align="left">
  <a href="https://github.com/yize"><img src="https://avatars.githubusercontent.com/u/1578814?v=4&s=48" width="48" height="48" alt="九神" title="九神"/></a>
  <a href="https://github.com/alex-mm"><img src="https://avatars.githubusercontent.com/u/3302053?v=4&s=48" width="48" height="48" alt="天晟" title="天晟"/></a>
  <a href="https://github.com/nicky1108"><img src="https://avatars.githubusercontent.com/u/4279283?v=4&s=48" width="48" height="48" alt="nicky1108" title="nicky1108"/></a>
  <a href="https://github.com/angelinheys"><img src="https://avatars.githubusercontent.com/u/49426983?v=4&s=48" width="48" height="48" alt="angelinheys" title="angelinheys"/></a>
  <a href="https://github.com/yipengmu"><img src="https://avatars.githubusercontent.com/u/3232735?v=4&s=48" width="48" height="48" alt="yipengmu" title="yipengmu"/></a>
  <a href="https://github.com/Waawww"><img src="https://avatars.githubusercontent.com/u/31886449?v=4&s=48" width="48" height="48" alt="Waawww" title="Waawww"/></a>
  <a href="https://github.com/kangjiano"><img src="https://avatars.githubusercontent.com/u/54129385?v=4&s=48" width="48" height="48" alt="kangjiano" title="kangjiano"/></a>
  <a href="https://github.com/ElZe98"><img src="https://avatars.githubusercontent.com/u/35736727?v=4&s=48" width="48" height="48" alt="ElZe98" title="ElZe98"/></a>
  <a href="https://github.com/OAHyuhao"><img src="https://avatars.githubusercontent.com/u/99954323?v=4&s=48" width="48" height="48" alt="OAHyuhao" title="OAHyuhao"/></a>
  <a href="https://github.com/xiaofu704"><img src="https://avatars.githubusercontent.com/u/209416122?v=4&s=48" width="48" height="48" alt="xiaofu704" title="xiaofu704"/></a>
  <a href="https://github.com/guchenglin111"><img src="https://avatars.githubusercontent.com/u/10860875?v=4&s=48" width="48" height="48" alt="guchenglin111" title="guchenglin111"/></a>
  <a href="https://github.com/liug0911"><img src="https://avatars.githubusercontent.com/u/1578814?v=4&s=48" width="48" height="48" alt="LIUG" title="LIUG"/></a>
  <a href="https://github.com/sunliz-xiuli"><img src="https://avatars.githubusercontent.com/u/76982855?v=4&s=48" width="48" height="48" alt="sunliz-xiuli" title="sunliz-xiuli"/></a>
  <a href="https://github.com/M12REDX"><img src="https://avatars.githubusercontent.com/u/22703542?v=4&s=48" width="48" height="48" alt="M12REDX" title="M12REDX"/></a>
</p>

---

## الرخصة

[MIT](./LICENSE) © 2026 Alibaba Group
