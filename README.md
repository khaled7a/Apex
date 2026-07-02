# Apex Sourcing

منصة رقمية لإدارة طلبات الاستيراد بالوكالة — راجع `docs/` للتصميم الكامل قبل قراءة أي كود:

- [`docs/state-machine.md`](docs/state-machine.md) — جدول الانتقالات الرسمي (مصدر الحقيقة الوحيد لآلة الحالة).
- [`docs/data-model.md`](docs/data-model.md) — نموذج البيانات الكامل ومصفوفة الصلاحيات.
- [`docs/schema.sql`](docs/schema.sql) — DDL مرجعي لـ PostgreSQL (الهجرات الفعلية في `migrations/` مشتقة منه حرفياً).

بنية المستودع: `packages/domain` (منطق آلة الحالة، بلا قاعدة بيانات) + `apps/api` (NestJS، الخادم الفعلي).

## المتطلبات

- Node.js ≥ 20، pnpm
- PostgreSQL 16 (محلياً أو عبر `docker-compose up -d`)

## الإعداد

```bash
pnpm install

# انسخ .env وعدّل القيم حسب بيئتك (الأسرار افتراضية للتطوير المحلي فقط)
cp .env.example .env   # إن لم يوجد .env بعد

# ينشئ الأدوار اللازمة على مستوى Postgres قبل أول هجرة:
#   - دور تشغيل الهجرات (سوبر يوزر أو صلاحيات كافية) — يُستخدم في DATABASE_URL
#   - app_role: الدور الذي يتصل به الخادم فعلياً (RLS و REVOKE على audit_log يُفرَضان عليه تحديداً)
psql -c "CREATE ROLE apex_migrator WITH LOGIN PASSWORD '...' SUPERUSER;"
psql -c "CREATE DATABASE apex_dev OWNER apex_migrator;"

pnpm --filter @apex/api migrate
psql -d apex_dev -c "ALTER ROLE app_role WITH PASSWORD '...';"   # يطابق APP_DATABASE_URL في .env
```

## التشغيل

```bash
pnpm --filter @apex/api dev      # تطوير مع إعادة تحميل تلقائي
pnpm --filter @apex/api build && pnpm --filter @apex/api start:prod
```

الخادم يُقلِع على `PORT` (افتراضياً 3000). توثيق OpenAPI التفاعلي على `/docs`.

**مهم**: الخادم يتصل دوماً كـ`app_role`، أبداً كدور الهجرات — RLS و`REVOKE UPDATE/DELETE` على `audit_log` مفروضان تحديداً على هذا الدور، والاتصال بدور مختلف (كالمالك) يتجاوزهما بصمت.

## متغيرات البيئة (`.env`)

| المتغير | الوصف |
|---|---|
| `DATABASE_URL` | اتصال بصلاحيات كافية لتشغيل الهجرات فقط (سكربتات `migrate`/`migrate:down`) — لا يستخدمه الخادم وقت التشغيل |
| `APP_DATABASE_URL` | اتصال `app_role` — هذا ما يستخدمه الخادم فعلياً |
| `JWT_CUSTOMER_SECRET` / `JWT_SUPPLIER_SECRET` / `JWT_ADMIN_SECRET` | أسرار توقيع JWT منفصلة لكل جمهور (3 جلسات مستقلة تماماً) |
| `BIDDING_DEADLINE_MS` | مدة نافذة المزايدة المغلقة بالميلي ثانية — افتراضياً 72 ساعة (`259200000`)؛ تُقصَّر بيئياً للاختبار/التطوير |
| `PORT` | منفذ الخادم |

## الاختبارات

```bash
pnpm --filter @apex/domain test          # 27 اختبار وحدة — منطق آلة الحالة، بلا شبكة/قاعدة بيانات
pnpm --filter @apex/api build            # فحص TypeScript كامل + تصريف
pnpm --filter @apex/api test:integration # ضد PostgreSQL حقيقي (apex_test) — RLS، القفل التفاؤلي، four-eyes، سلسلة سجل التدقيق
```

اختبارات التكامل تتطلب قاعدة بيانات `apex_test` منفصلة عن `apex_dev`، مُهاجَرة بنفس الطريقة:

```bash
psql -c "CREATE DATABASE apex_test OWNER apex_migrator;"
DATABASE_URL="postgres://apex_migrator:...@127.0.0.1:5432/apex_test" pnpm --filter @apex/api migrate
psql -d apex_test -c "ALTER ROLE app_role WITH PASSWORD '...';"
```

## نطاق v1 الحالي

مسار عمودي كامل مُختبَر فعلياً من طرف لطرف: تقديم الطلب → المزايدة المغلقة (مؤقّت pg-boss فعلي، عزل RLS حقيقي بين الموردين) → التعاقد → **التحقق المزدوج للدفعة الأولى بـfour-eyes حقيقي** (مقترِح ومُعتمِد شخصان مختلفان فعلياً، لا مجرد فحص دور) → كشف الهوية → **مسار النزاع الإلزامي** (أي إلغاء بعد تأكيد دفعة أمانة يُحال تلقائياً لتسوية four-eyes بدل إلغاء صامت).

مؤجَّل عمداً لـ v2 (سقالة فارغة في الكود): تفاصيل Checkpoints الإنتاج، التصعيد الديناميكي، سلسلة الشحن/التخليص الكاملة، التجديد، التقييمات، مسار المورد الخارجي الكامل، وإشعارات فعلية (بريد/SMS).

## سجل الإصلاحات المكتشفة أثناء البناء

عدة ثغرات تصميمية حقيقية (لا تفاصيل تجميلية) انكشفت فقط أثناء التشغيل الفعلي ضد PostgreSQL حي — لا أثناء المراجعة أو التخطيط — وأُصلحت فوراً، بينها: قيد "منع نزاعين متزامنين" كان بلا أثر فعلياً وتم نقله لمكانه الصحيح، `state_version` كان يتعارض مع الحلقات الذاتية (كتعدد عروض المزايدة) فيُفسد مؤقّت الموعد النهائي، RLS الموحَّد بين القراءة والكتابة كان يمنع كتابات مشروعة بالفعل تحقق منها محرك الانتقالات، واعتماد دائري بين خدمتين تسبَّب بتوقف صامت للخادم بلا أي خطأ ظاهر. كل إصلاح موثَّق في تعليق أعلى الكود/الهجرة المعنية مباشرة — ابحث عن كلمة "discovered" أو "إصلاح" في `migrations/` و`src/` لسياق كل قرار.
