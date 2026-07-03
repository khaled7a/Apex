# بوابة العميل — إيبيكس سورس

Next.js (App Router) + TypeScript + Tailwind CSS، عربي/RTL بالكامل، تغطي دورة حياة الطلب الكاملة من جهة العميل ضد `apps/api`.

## التشغيل

```bash
cp .env.example .env.local   # عدّل API_URL إن لزم (افتراضياً http://localhost:3000)
pnpm --filter @apex/web-customer dev -p 3001
```

يتطلب تشغيل `apps/api` (مهاجَرة، مع `FRONTEND_ORIGIN=http://localhost:3001` في `.env` الجذر) على المنفذ 3000.

## البنية

- `src/actions/*.ts` — Server Actions لكل مجال (orders, bidding, contracts, payments, production, disputes...) تستدعي الـAPI مباشرة من جهة الخادم.
- `src/lib/api.ts` — عميل fetch نحيف، يرفق كوكي الجلسة (`apex_customer_token`، httpOnly) تلقائياً.
- `src/lib/state-labels.ts` — تسميات عربية للحالات + جدول "ماذا الآن؟" حسب `(current_state, hold_type)`.
- `src/proxy.ts` — يحمي مسارات `(portal)` (بديل Middleware في Next.js 16).
- `src/app/(portal)/orders/[orderId]/` — صفحة مركزية مرنة (تايم لاين + إجراء) + صفحات مخصَّصة للتفاعلات الثقيلة (عروض، عقد، دفع، تصنيع، جمارك، نزاع، تجديد، تسليم، تقييم).

الجلسة عبر كوكي httpOnly تُعيَّن من داخل Server Actions مباشرة (`src/actions/auth.ts`) — التوكن لا يصل لجافاسكربت المتصفح إطلاقاً.
