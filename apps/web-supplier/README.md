# بوابة المورد — إيبيكس سورس

Next.js (App Router) + TypeScript + Tailwind CSS، عربي/RTL بالكامل، تغطي دورة حياة الطلب من جهة المورد ضد `apps/api`.

## التشغيل

```bash
cp .env.example .env.local   # عدّل API_URL إن لزم (افتراضياً http://localhost:3000)
pnpm --filter @apex/web-supplier dev -p 3002
```

يتطلب تشغيل `apps/api` (مهاجَرة) على المنفذ 3000. **لا صفحة تسجيل ذاتي** — حسابات الموردين تُنشأ عبر `POST /admin/suppliers` من الإدارة فقط.

## البنية

- `src/actions/*.ts` — Server Actions لكل مجال (bidding, production, payments, escalation, disputes, renewals) تستدعي الـAPI مباشرة من جهة الخادم.
- `src/lib/api.ts` — عميل fetch نحيف، يرفق كوكي الجلسة (`apex_supplier_token`، httpOnly) تلقائياً.
- `src/lib/state-labels.ts` — تسميات عربية للحالات من منظور المورد + `getSupplierAction` (جدول "ماذا الآن؟" حسب `(current_state, hold_type, escalationActor)`).
- `src/proxy.ts` — يحمي مسارات `(portal)` (بديل Middleware في Next.js 16).
- `src/app/(portal)/dashboard` — قسمان: "عروض مفتوحة للمزايدة" (`GET /bidding/board`) و"طلباتي" (`GET /orders/assigned-to-me`).
- `src/app/(portal)/bidding-board/[orderId]` — تفاصيل طلب مفتوح + نموذج تقديم عرض.
- `src/app/(portal)/orders/[orderId]/` — صفحة مركزية مرنة (تايم لاين + إجراء) + صفحات مخصَّصة (إنتاج/تصميم/QC، تأكيد دفعة، تصعيد، نزاع، تجديد).

الجلسة عبر كوكي httpOnly تُعيَّن من داخل Server Actions مباشرة (`src/actions/auth.ts`) — التوكن لا يصل لجافاسكربت المتصفح إطلاقاً.
