# جدول الانتقالات الرسمي (State Transition Table)

هذا المستند يحوّل مخطط `Mermaid` الأصلي في `apex_platform_project_brief.md` إلى جدول انتقالات صريح وكامل، بعد دمج كل الإصلاحات التي خرجت من المراجعة النقدية (`/root/.claude/plans/...floating-sparkle.md`) والقرارات الأربعة المتفق عليها. هذا الجدول هو **مصدر الحقيقة الوحيد** لأي منطق حالة يُبنى لاحقاً — لا يُسمح بأي انتقال غير موجود هنا (deny-by-default).

كل صف يمثل قاعدة يفرضها محرك انتقالات مركزي (Transition Engine)، وليس تحديثاً مباشراً لحقل `status`. أي إضافة على هذا الجدول لاحقاً يجب أن تُراجَع هنا أولاً قبل الكود.

الصفوف المعلَّمة **[إصلاح]** هي حالات/انتقالات جديدة أضيفت لسد ثغرة حرجة رصدتها المراجعة ولم تكن موجودة في المخطط الأصلي.

---

## 0. مبادئ حاكمة على الجدول كله

1. **لا تحديث مباشر لـ `current_state`.** كل تغيير يمر عبر دالة `transition(order_id, event, actor, payload)` التي تتحقق من: (أ) أن `(from_state, event)` موجود بالجدول، (ب) أن دور الفاعل ضمن `allowed_roles`، (ج) أن كل الحراسات (guards) محقَّقة، ثم تنفّذ الانتقال + كتابة `AuditLog` + الإشعارات كمعاملة ذرية واحدة.
2. **قفل تفاؤلي**: كل طلب انتقال يحمل `expected_current_state`؛ أي عدم تطابق يُرفض فوراً (منع سباق تحديثات متزامنة بين تصعيد تلقائي واعتماد يدوي في نفس اللحظة).
3. **النزاع والتصعيد حالتان موازيتان لا استبدال**: فتح نزاع أو دخول تصعيد يُسجَّل في حقل مستقل (`hold_type` + `resume_target_state`) بينما يبقى `current_state` كما هو، وتُعلَّق فقط قدرة الطلب على التقدم للأمام. هذا يحل مشكلة "التعليق المتزامن" (نزاع أثناء تصعيد) لأن كليهما يستخدمان نفس آلية التعليق المستقلة عن `current_state`، مع قيد صريح: **لا يُسمح بفتح نزاع جديد إذا كان `hold_type` النشط الحالي من نوع نزاع بالفعل** (نزاع ثانٍ يُضاف كبند إضافي على النزاع المفتوح، لا نزاعاً مستقلاً). تصعيد نشط + نزاع جديد مسموح (حالتان مختلفتا الطبيعة)، لكن حل النزاع لا يُغلق التصعيد تلقائياً والعكس.
4. **`service_type` لا يُفرّع آلة الحالة إلى 3 نسخ منفصلة.** بدلاً من ذلك، كل `ServiceType` (كيان إعدادات قابل للتوسعة من لوحة الإدارة) يحمل أعلام تضمين (inclusion flags) تُستخدم كحارس على مجموعات كاملة من الحالات:
   - `includes_sourcing` — هل تُفعَّل `SupplierChoice`/`RegisteredPath`/`ExternalPath` أم يُتخطى المصدر بالكامل (حالة الشراء الذاتي المسبق من العميل)؟
   - `includes_identity_management` — هل يُفعَّل التجهيل + `IdentityRevealed`؟
   - `includes_production_oversight` — هل تُفعَّل `Production` بكامل حالاتها (تصميم/Checkpoint1/فحص نهائي/Checkpoint2)؟
   - `includes_customs_clearance` — دائماً `true` عملياً لكنه أُبقي كعلم لعدم افتراض ثبات مستقبلي.
   
   هذا يسمح بإضافة أنواع خدمة مستقبلية دون تعديل آلة الحالة نفسها — فقط تركيبة أعلام جديدة على `ServiceType`. القيم الثلاث الحالية:
   
   | service_type | includes_sourcing | includes_identity_management | includes_production_oversight |
   |---|---|---|---|
   | `DOOR_TO_DOOR` (باب لباب) | ✅ (عبر `RegisteredPath` غالباً) | ✅ | ✅ (يشمل العينات) |
   | `SHIPPING_CLEARANCE_ONLY` (شحن وتخليص فقط) | ❌ | ❌ | ❌ |
   | `EXTERNAL_SUPPLIER_SERVICE` (مورد خارجي) | ✅ (عبر `ExternalPath` حصراً — `includes_sourcing=true` لكن `bidding_enabled=false`) | ✅ | ⚙️ قابل للتحديد إدارياً لكل طلب (المورد الخارجي قد يقدّم عينة أو لا) |
   
5. **نوع المورد (`supplier_type`: مسجَّل/خارجي) مستقل عن `service_type`** — هو ما يحدد الفرع عند `SupplierChoice` (`RegisteredPath` بالمزايدة، أو `ExternalPath` بلا مزايدة)، بصرف النظر عن نوع الخدمة، طالما `includes_sourcing = true`.
6. **الدفعات الموجَّهة للمورد ("أمانة") تمر جميعها بنفس آلة التحقق المزدوج الفرعية** (قسم 4)، وليس فقط الدفعة الأولى — هذا تنفيذ للقرار المتفق عليه مع صاحب المشروع.

---

## 1. قائمة الحالات الكاملة (مسطّحة، بعد الإصلاح)

| المعرف | الاسم | نوع | المرحلة الأم |
|---|---|---|---|
| `DRAFT` | مسودة الطلب | بسيطة | — |
| `SUBMITTED` | تقديم + عربون غير مرجع | بسيطة | — |
| `REVIEW_PENDING` | قيد المراجعة | فرعية | AdminReview |
| `REVIEW_NEEDS_EDIT` | يحتاج تعديل | فرعية | AdminReview |
| `REVIEW_APPROVED` | معتمد | فرعية | AdminReview |
| `REVIEW_REJECTED` | مرفوض | فرعية | AdminReview |
| `SUPPLIER_CHOICE` | نوع المورد؟ (choice) | pseudostate | — |
| `EXT_VETTING_DOCS` | فحص/تحقق مورد خارجي | فرعية | ExternalPath |
| `EXT_VETTING_APPROVED` | اعتماد مورد خارجي | فرعية | ExternalPath |
| `EXT_VETTING_REJECTED` | رفض مورد خارجي | فرعية | ExternalPath |
| `REG_PUBLISHED` | نشر لكل الموردين المسجَّلين | فرعية | RegisteredPath |
| `REG_BIDS_COLLECTING` | استقبال عروض (48-72س) | فرعية | RegisteredPath |
| `REG_BIDS_EXPIRED_NO_OFFERS` **[إصلاح]** | انتهت المهلة بلا عروض كافية | فرعية | RegisteredPath |
| `REG_ADMIN_REVIEW_BIDS` | مراجعة/اعتماد العروض | فرعية | RegisteredPath |
| `REG_SHOWN_TO_CUSTOMER` | عرض للعميل (مجهّل) | فرعية | RegisteredPath |
| `REG_CUSTOMER_SELECTS` | العميل يختار عرضاً | فرعية | RegisteredPath |
| `REG_NO_OFFER_SELECTED` **[إصلاح]** | العميل رفض كل العروض | فرعية | RegisteredPath |
| `CONTRACT_PAYMENT_PLAN_CREATED` | إنشاء خطة الدفعات | فرعية | ContractStage |
| `CONTRACT_SIGNED` | توقيع العقد الإلكتروني | فرعية | ContractStage |
| `CONTRACT_BANK_TRANSFER_DONE` | تحويل بنكي (إشعار العميل) | فرعية | ContractStage |
| `CONTRACT_RECEIPT_UPLOADED` | رفع إيصال التحويل | فرعية | ContractStage |
| `CONTRACT_ADMIN_VERIFYING` | تحقق الإدارة قيد التنفيذ | فرعية | ContractStage |
| `CONTRACT_RECEIPT_REJECTED` **[إصلاح]** | الإيصال مرفوض (مبلغ خاطئ/مزوَّر) | فرعية | ContractStage |
| `IDENTITY_REVEALED` | كشف هوية المورد | بسيطة | — |
| `PAYMENT_PENDING_SUPPLIER_ACK` **[إصلاح]** | بانتظار تأكيد المورد الأولي | بسيطة | — |
| `PAYMENT_PENDING_ADMIN_VERIFICATION` **[إصلاح]** | بانتظار تحقق الإدارة مع المورد | بسيطة | — |
| `SUPPLIER_PAYMENT_CONFIRMED` | تأكيد نهائي ⏱ (بداية عداد التصنيع) | بسيطة | — |
| `PROD_DESIGN_SUBMITTED` | رفع تصميم/عينة | فرعية | Production |
| `PROD_CHECKPOINT_1` | ✋ بانتظار اعتماد العميل | فرعية | Production |
| `PROD_CHECKPOINT_1_REJECTED` **[إصلاح]** | العميل رفض التصميم صراحة | فرعية | Production |
| `PROD_FULL_PRODUCTION` | تصنيع كامل + تحديثات | فرعية | Production |
| `PROD_QC_SUBMITTED` | رفع صور الفحص النهائي | فرعية | Production |
| `PROD_CHECKPOINT_2` | ✋ بانتظار اعتماد ما قبل الشحن | فرعية | Production |
| `PROD_CHECKPOINT_2_REJECTED` **[إصلاح]** | العميل رفض الفحص النهائي صراحة | فرعية | Production |
| `ESCALATION_REMINDER` | تذكير تلقائي | فرعية | EscalationFlow |
| `ESCALATION_ESCALATED` | تصعيد للإدارة | فرعية | EscalationFlow |
| `AGREEMENT_CANCELLED_PENDING_RENEWAL` | إلغاء اتفاقية بعد تصعيد | بسيطة | — |
| `RENEWAL_PENDING_SUPPLIER` **[إصلاح]** | بانتظار موافقة المورد على التجديد | فرعية | RenewalRequested |
| `RENEWAL_PENDING_ADMIN` **[إصلاح]** | بانتظار موافقة الإدارة على التجديد | فرعية | RenewalRequested |
| `RENEWAL_SUPPLIER_DECLINED` **[إصلاح]** | المورد رفض التجديد | فرعية | RenewalRequested |
| `LOGISTICS_ONLY_SETUP` **[إصلاح]** | إعداد عقد خدمة لوجستية مبسّط (SHIPPING_CLEARANCE_ONLY) | بسيطة | — |
| `LOADING_SHIPPING` | التحميل والشحن | بسيطة | — |
| `SHIPPING_DOCS` | رفع مستندات الشحنة | بسيطة | — |
| `PAYMENT_INSTALLMENTS_PENDING` | تفعيل دفعة/دفعات الشحن | بسيطة | — |
| `IN_TRANSIT` | الشحنة في الطريق | بسيطة | — |
| `ARRIVED_PORT` | وصول الشحنة للميناء | بسيطة | — |
| `CUSTOMS_FEE_ADDED` | إضافة مرحلة رسوم | فرعية | CustomsClearance |
| `CUSTOMS_CUSTOMER_PAYS` | العميل يدفع | فرعية | CustomsClearance |
| `CUSTOMS_FEE_PROOF_UPLOADED` | رفع إثبات الدفع | فرعية | CustomsClearance |
| `CUSTOMS_FEE_VERIFIED` **[إصلاح]** | تحقق الإدارة من دفع الرسم | فرعية | CustomsClearance |
| `FINAL_DELIVERY` | التسليم النهائي | بسيطة | — |
| `CUSTOMER_SIGNED` | توقيع الاستلام | بسيطة | — |
| `SUPPLIER_RATED` | تقييم المورد | بسيطة | — |
| `COMPLETED` **[إصلاح]** | مكتمل (نهائية حقيقية) | نهائية | — |
| `DISPUTE_PAYMENT` | نزاع دفع | فرعية | Disputed |
| `DISPUTE_QUALITY` | نزاع جودة | فرعية | Disputed |
| `DISPUTE_DELAY` | نزاع تأخير | فرعية | Disputed |
| `DISPUTE_SHIPPING` **[موسّعة]** | نزاع شحن (يشمل الآن InTransit/ArrivedPort/FinalDelivery/CustomerSigned) | فرعية | Disputed |
| `DISPUTE_MANDATORY_REFUND` **[إصلاح]** | نزاع دفع إلزامي (إلغاء كامل بلا تسليم) | فرعية | Disputed |
| `DISPUTE_RESOLVED` | محلول | فرعية | Disputed |
| `CANCELLED` | ملغى (نهائية) | نهائية | — |

---

## 2. جدول الانتقالات — من التقديم حتى اختيار المورد

| من | الحدث/الحارس | الفاعل | الأثر | إلى |
|---|---|---|---|---|
| `DRAFT` | العميل يقدّم الطلب | عميل | — | `SUBMITTED` |
| `SUBMITTED` | تحصيل العربون بنجاح (غير قابل للاسترجاع) | نظام | `Payment{type=DEPOSIT, refund_policy=NEVER_REFUNDABLE}` | `REVIEW_PENDING` |
| `REVIEW_PENDING` | الإدارة تطلب تعديلاً | إدارة (مشغّل) | — | `REVIEW_NEEDS_EDIT` |
| `REVIEW_NEEDS_EDIT` | العميل يعيد التقديم | عميل | — | `REVIEW_PENDING` |
| `REVIEW_PENDING` | اعتماد الطلب | إدارة (مشغّل) | يُحدَّد `service_type` نهائياً هنا | `SUPPLIER_CHOICE` |
| `REVIEW_PENDING` | رفض الطلب | إدارة (مالك أو مشغّل) | العربون يبقى إيراد شركة (غير مرتبط بالرفض) | `REVIEW_REJECTED` |
| `REVIEW_REJECTED` | إغلاق نظامي **[إصلاح]** | نظام (تلقائي فور الرفض) | إشعار عام للعميل، إقفال محاسبي للطلب | `CANCELLED` |
| `SUPPLIER_CHOICE` | `includes_sourcing = false` (شحن وتخليص فقط) **[إصلاح]** | نظام (حارس تلقائي) | — | `LOGISTICS_ONLY_SETUP` |
| `SUPPLIER_CHOICE` | العميل معه مورد خاص | نظام (حارس على `supplier_type`) | — | `EXT_VETTING_DOCS` |
| `SUPPLIER_CHOICE` | من القاعدة المسجَّلة | نظام (حارس على `supplier_type`) | — | `REG_PUBLISHED` |

### مسار المورد الخارجي
| من | الحدث/الحارس | الفاعل | الأثر | إلى |
|---|---|---|---|---|
| `EXT_VETTING_DOCS` | اعتماد (License + سنوات نشاط + aiqicha/qcc) | إدارة (مشغّل يتحقق، مالك يعتمد) | `SupplierRating{phase=PRE_CONTRACT}` | `EXT_VETTING_APPROVED` |
| `EXT_VETTING_DOCS` | رفض | إدارة (مالك) | — | `EXT_VETTING_REJECTED` |
| `EXT_VETTING_APPROVED` | متابعة | نظام | — | `CONTRACT_PAYMENT_PLAN_CREATED` |
| `EXT_VETTING_REJECTED` | إغلاق | نظام | العربون يبقى غير مسترجع | `CANCELLED` |

### مسار الموردين المسجَّلين (مزايدة مغلقة)
| من | الحدث/الحارس | الفاعل | الأثر | إلى |
|---|---|---|---|---|
| `REG_PUBLISHED` | نشر تلقائي مفتوح — بلا حجب حسب الفئة (قرار معتمد) | نظام | نشر لكل الموردين المسجَّلين النشطين؛ الفئة تبقى حقلاً وصفياً على ملف المورد | `REG_BIDS_COLLECTING` |
| `REG_BIDS_COLLECTING` | مورد يقدّم عرضاً | مورد مسجَّل (ضمن المهلة) | عزل بيانات كامل — كل مورد يرى عرضه فقط | `REG_BIDS_COLLECTING` (لا تغيير حالة) |
| `REG_BIDS_COLLECTING` | انتهت المهلة (48-72س) وورد عرض واحد على الأقل | نظام (مؤقّت مجدوَل) | — | `REG_ADMIN_REVIEW_BIDS` |
| `REG_BIDS_COLLECTING` | انتهت المهلة بلا أي عرض **[إصلاح]** | نظام (مؤقّت مجدوَل) | — | `REG_BIDS_EXPIRED_NO_OFFERS` |
| `REG_BIDS_EXPIRED_NO_OFFERS` | تمديد المهلة يدوياً **[إصلاح]** | إدارة (مشغّل) | مؤقّت جديد 48-72س | `REG_BIDS_COLLECTING` |
| `REG_BIDS_EXPIRED_NO_OFFERS` | إلغاء الطلب **[إصلاح]** | إدارة (مالك) | العربون غير مسترجع؛ إشعار اعتذار للعميل | `CANCELLED` |
| `REG_ADMIN_REVIEW_BIDS` | اعتماد العروض (عرض واحد فقط مسموح لكن يُعلَّم `low_competition=true`) | إدارة (مشغّل) | إدخال `fx_rate_used` لكل عرض معتمد + `fx_rate_source` | `REG_SHOWN_TO_CUSTOMER` |
| `REG_SHOWN_TO_CUSTOMER` | العميل يختار عرضاً | عميل | كشف مبدئي: اسم المورد وتقييماته (بلا معلومات اتصال) | `REG_CUSTOMER_SELECTS` |
| `REG_SHOWN_TO_CUSTOMER` | العميل يرفض كل العروض **[إصلاح]** | عميل | — | `REG_NO_OFFER_SELECTED` |
| `REG_NO_OFFER_SELECTED` | إعادة نشر لموردين إضافيين **[إصلاح]** | إدارة (مشغّل) | — | `REG_PUBLISHED` |
| `REG_NO_OFFER_SELECTED` | إلغاء الطلب **[إصلاح]** | إدارة (مالك) | العربون غير مسترجع | `CANCELLED` |
| `REG_CUSTOMER_SELECTS` | متابعة | نظام | — | `CONTRACT_PAYMENT_PLAN_CREATED` |

---

## 3. التعاقد والدفعة الأولى

| من | الحدث/الحارس | الفاعل | الأثر | إلى |
|---|---|---|---|---|
| `CONTRACT_PAYMENT_PLAN_CREATED` | إنشاء خطة دفعات يدوية (عدد/نسب/توقيت لكل طلب) | إدارة (مشغّل ينشئ، محاسب يعتمد الأرقام) | `PaymentPlan` + `PaymentInstallment[]` | `CONTRACT_SIGNED` (بعد التوقيع) |
| `CONTRACT_PAYMENT_PLAN_CREATED` | العميل يوقّع العقد الإلكتروني | عميل | `Contract.signed_at` | `CONTRACT_SIGNED` |
| `CONTRACT_SIGNED` | العميل يُخطر بإتمام التحويل البنكي | عميل | `PaymentInstallment{status=CUSTOMER_NOTIFIED_TRANSFERRED}` | `CONTRACT_BANK_TRANSFER_DONE` |
| `CONTRACT_BANK_TRANSFER_DONE` | رفع إيصال التحويل | عميل | يُحسب `receipt_fingerprint = hash(bank_ref + amount + date)`؛ رفض تلقائي إن تكرر عبر أي طلب/دفعة أخرى | `CONTRACT_RECEIPT_UPLOADED` |
| `CONTRACT_RECEIPT_UPLOADED` | بدء التحقق | إدارة (مشغّل) | — | `CONTRACT_ADMIN_VERIFYING` |
| `CONTRACT_ADMIN_VERIFYING` | تطابق تام (مرجع + مبلغ + بنك) | إدارة (محاسب يعتمد نهائياً) | `Payment.verified_at`, `Payment.verified_by` | `PAYMENT_PENDING_SUPPLIER_ACK` |
| `CONTRACT_ADMIN_VERIFYING` | عدم تطابق/إيصال مزوَّر **[إصلاح]** | إدارة (محاسب) | سبب رفض إلزامي مسجَّل بالتدقيق | `CONTRACT_RECEIPT_REJECTED` |
| `CONTRACT_RECEIPT_REJECTED` | إعادة رفع إيصال **[إصلاح]** | عميل | — | `CONTRACT_RECEIPT_UPLOADED` |
| `CONTRACT_RECEIPT_REJECTED` | تصعيد لنزاع دفع (إن تكرر الرفض) **[إصلاح]** | إدارة (مالك) | — | `DISPUTE_PAYMENT` |

### آلة التحقق المزدوج للدفعات الموجَّهة للمورد (قابلة لإعادة الاستخدام — تُطبَّق على الدفعة الأولى وكل دفعة أمانة لاحقة)

هذا يستبدل `SupplierConfirmsPayment` الأصلية (تأكيد طرف واحد) بالتحقق المزدوج المتفق عليه:

| من | الحدث/الحارس | الفاعل | الأثر | إلى |
|---|---|---|---|---|
| `PAYMENT_PENDING_SUPPLIER_ACK` | المورد يضغط "استلمت المبلغ" | مورد | **إشعار أولي فقط — لا يُقفل الاسترجاع ولا يبدأ أي عداد بعد** | `PAYMENT_PENDING_ADMIN_VERIFICATION` |
| `PAYMENT_PENDING_ADMIN_VERIFICATION` | الإدارة تتحقق فعلياً مع المورد (اتصال/كشف حساب) خلال نافذة SLA محددة | إدارة (مشغّل يتحقق، محاسب/مالك يعتمد للمبالغ الكبيرة — four-eyes) | معاملة ذرية واحدة: (1) `is_refundable → LOCKED`, (2) `financial_commitment_started_at = now()` **فقط إذا كانت هذه أول دفعة أمانة لهذا الطلب**, (3) سجل تدقيق موقَّع | `SUPPLIER_PAYMENT_CONFIRMED` |
| `PAYMENT_PENDING_ADMIN_VERIFICATION` | تعذّر التحقق مع المورد (إنكار/عدم رد) | إدارة (مالك) | — | `DISPUTE_PAYMENT` |
| `SUPPLIER_PAYMENT_CONFIRMED` | (فقط عند أول دفعة أمانة) متابعة لكشف الهوية | نظام | — | `IDENTITY_REVEALED` |
| `IDENTITY_REVEALED` | متابعة | نظام | حدث تدقيق مستقل موقَّع؛ لا يُكشف أي رقم اتصال مباشر أبداً | `PROD_DESIGN_SUBMITTED` (إن `includes_production_oversight`) أو `LOADING_SHIPPING` مباشرة (إن لم تكن مطلوبة) |

> **ملاحظة تنفيذية:** لأي دفعة أمانة لاحقة غير الأولى (مثل دفعات `PAYMENT_INSTALLMENTS_PENDING` أثناء الشحن)، تُعاد نفس آلة `PAYMENT_PENDING_SUPPLIER_ACK → PAYMENT_PENDING_ADMIN_VERIFICATION → SUPPLIER_PAYMENT_CONFIRMED` كحالة فرعية معلَّقة داخل `PAYMENT_INSTALLMENTS_PENDING` نفسها، دون أن تُعيد فتح `financial_commitment_started_at` أو `IDENTITY_REVEALED` (تُنفَّذ مرة واحدة فقط لكل طلب).

---

## 4. مرحلة التصنيع (Production) — مشروطة بـ `includes_production_oversight`

| من | الحدث/الحارس | الفاعل | الأثر | إلى |
|---|---|---|---|---|
| `PROD_DESIGN_SUBMITTED` | المورد يرفع تصميم/عينة | مورد | يبدأ SLA اعتماد العميل | `PROD_CHECKPOINT_1` |
| `PROD_CHECKPOINT_1` | العميل يعتمد | عميل | — | `PROD_FULL_PRODUCTION` |
| `PROD_CHECKPOINT_1` | العميل يرفض صراحة (مع سبب) **[إصلاح]** | عميل | يختلف عن التأخر/الصمت — لا يدخل `EscalationFlow` | `PROD_CHECKPOINT_1_REJECTED` |
| `PROD_CHECKPOINT_1_REJECTED` | المورد يرفع تصميماً معدَّلاً | مورد | عدّاد SLA يُعاد | `PROD_CHECKPOINT_1` |
| `PROD_CHECKPOINT_1` | لا استجابة ضمن مهلة العميل | نظام (مؤقّت) | — | `ESCALATION_REMINDER` (نوع=`CUSTOMER_APPROVAL`) |
| `PROD_DESIGN_SUBMITTED` | لا رفع من المورد ضمن مهلة SLA المورد **[إصلاح]** | نظام (مؤقّت) | تصعيد مطابق تماماً لتصعيد العميل لكن `escalation_actor=SUPPLIER` | `ESCALATION_REMINDER` (نوع=`SUPPLIER_DELIVERABLE`) |
| `PROD_FULL_PRODUCTION` | المورد يرفع صور فحص نهائي | مورد | — | `PROD_QC_SUBMITTED` |
| `PROD_FULL_PRODUCTION` | لا تحديثات من المورد ضمن SLA (فترة صمت غير طبيعية) **[إصلاح]** | نظام (مؤقّت) | — | `ESCALATION_REMINDER` (نوع=`SUPPLIER_DELIVERABLE`) |
| `PROD_QC_SUBMITTED` | متابعة | نظام | — | `PROD_CHECKPOINT_2` |
| `PROD_CHECKPOINT_2` | العميل يعتمد | عميل | — | `LOADING_SHIPPING` |
| `PROD_CHECKPOINT_2` | العميل يرفض صراحة (مع سبب) **[إصلاح]** | عميل | — | `PROD_CHECKPOINT_2_REJECTED` |
| `PROD_CHECKPOINT_2_REJECTED` | المورد يعالج الملاحظة ويعيد الرفع | مورد | — | `PROD_QC_SUBMITTED` |
| `PROD_CHECKPOINT_2` | لا استجابة ضمن مهلة العميل | نظام (مؤقّت) | — | `ESCALATION_REMINDER` (نوع=`CUSTOMER_APPROVAL`) |

### التصعيد (معمَّم على العميل والمورد معاً — إصلاح جوهري)

| من | الحدث/الحارس | الفاعل | الأثر | إلى |
|---|---|---|---|---|
| `ESCALATION_REMINDER` | استجاب الطرف المعنيّ (عميل أو مورد) | عميل/مورد | العودة لـ`resume_target_state` المحفوظة عند دخول التصعيد | `PROD_*` (الحالة المحفوظة) |
| `ESCALATION_REMINDER` | لا استجابة خلال مهلة ثابتة محدَّدة إدارياً **[إصلاح: مهلة رقمية إلزامية بدل الغموض الحالي]** | نظام (مؤقّت) | — | `ESCALATION_ESCALATED` |
| `ESCALATION_ESCALATED` | استجاب الطرف بعد تدخل الإدارة | عميل/مورد | — | `PROD_*` (الحالة المحفوظة) |
| `ESCALATION_ESCALATED` (نوع=`CUSTOMER_APPROVAL`) | لا استجابة نهائية | إدارة (مالك) | — | `AGREEMENT_CANCELLED_PENDING_RENEWAL` |
| `ESCALATION_ESCALATED` (نوع=`SUPPLIER_DELIVERABLE`) **[إصلاح]** | لا استجابة نهائية من المورد | إدارة (مالك) | يُفتح **نزاع تأخير تلقائي** بدل الإلغاء المباشر — لأن التقصير من طرف المورد لا العميل، والعميل له حق تعويض/تغيير مورد لا فقدان كامل | `DISPUTE_DELAY` |

---

## 5. التجديد وإلغاء الاتفاقية

| من | الحدث/الحارس | الفاعل | الأثر | إلى |
|---|---|---|---|---|
| `AGREEMENT_CANCELLED_PENDING_RENEWAL` | العميل يطلب تجديد الاتفاقية | عميل | `AgreementRenewal{renewal_of_agreement_id}` | `RENEWAL_PENDING_SUPPLIER` **[إصلاح: حالتان منفصلتان بدل حالة واحدة]** |
| `RENEWAL_PENDING_SUPPLIER` | المورد يوافق | مورد | — | `RENEWAL_PENDING_ADMIN` |
| `RENEWAL_PENDING_SUPPLIER` | المورد يرفض **[إصلاح]** | مورد | لا يُعامَل كرفض إداري | `RENEWAL_SUPPLIER_DECLINED` |
| `RENEWAL_SUPPLIER_DECLINED` | العميل يختار مورداً بديلاً بنفس شروط الطلب المعتمد أصلاً **[إصلاح: بديل أخف من الإلغاء الكامل]** | إدارة (مشغّل) | يعود لـ`REG_PUBLISHED` أو `EXT_VETTING_DOCS` بمورد آخر، دون خسارة اعتماد الطلب الأصلي | `SUPPLIER_CHOICE` |
| `RENEWAL_SUPPLIER_DECLINED` | العميل يفضّل الإلغاء الكامل | عميل | — | `CANCELLED` عبر `DISPUTE_MANDATORY_REFUND` (انظر أدناه) |
| `RENEWAL_PENDING_ADMIN` | الإدارة توافق (المورد نفسه موافق مسبقاً) | إدارة (مالك) | استئناف **دقيق** إلى `resume_target_state` المحفوظة وقت الإلغاء (وليس بداية `Production` من جديد) | `resume_target_state` |
| `RENEWAL_PENDING_ADMIN` | الإدارة ترفض | إدارة (مالك) | — | `CANCELLED` عبر `DISPUTE_MANDATORY_REFUND` |

### القاعدة الحاكمة الجديدة لأي `→ CANCELLED` بعد تحويل دفعة أمانة فعلياً **[إصلاح — القرار المعتمد]**

أي مسار وصل إلى `CANCELLED` **بعد** أن حدث `SUPPLIER_PAYMENT_CONFIRMED` مرة واحدة على الأقل لهذا الطلب، **لا ينتقل مباشرة** إلى `CANCELLED`. يُفتح إلزامياً وتلقائياً `DISPUTE_MANDATORY_REFUND` أولاً:

| من | الحدث/الحارس | الفاعل | الأثر | إلى |
|---|---|---|---|---|
| أي حالة إلغاء بعد `SUPPLIER_PAYMENT_CONFIRMED` | فتح تلقائي | نظام | يحسب `production_progress_ratio` (نسبة تقدّم مبنية على آخر Checkpoint مكتمل) كمدخل استرشادي للإدارة | `DISPUTE_MANDATORY_REFUND` |
| `DISPUTE_MANDATORY_REFUND` | قرار الإدارة (استرداد جزئي/كامل/رفض) | إدارة (مالك + محاسب معاً — four-eyes) | `RefundTransaction` مستقل؛ **لا تعديل على `is_refundable` الأصلي للدفعة** | `DISPUTE_RESOLVED` |
| `DISPUTE_RESOLVED` (من `DISPUTE_MANDATORY_REFUND`) | إغلاق نهائي | نظام | — | `CANCELLED` |

أي إلغاء **قبل** أي `SUPPLIER_PAYMENT_CONFIRMED` (رفض إداري، رفض مورد خارجي، رفض تجديد بلا دفعة محوَّلة) ينتقل مباشرة لـ`CANCELLED` بلا نزاع إلزامي — العربون فقط محصَّل وهو دائماً غير مسترجع بلا استثناء.

---

## 6. الشحن، التخليص، التسليم

| من | الحدث/الحارس | الفاعل | الأثر | إلى |
|---|---|---|---|---|
| `LOGISTICS_ONLY_SETUP` (مسار SHIPPING_CLEARANCE_ONLY) **[إصلاح]** | توقيع عقد خدمة لوجستية مبسّط + دفع عمولة الشركة (لا "دفعة أمانة" لمورد لأن العميل اشترى البضاعة مسبقاً) | عميل ثم إدارة (تحقق) | `Contract{type=LOGISTICS_ONLY}` | `LOADING_SHIPPING` |
| `LOADING_SHIPPING` | متابعة | نظام/إدارة | — | `SHIPPING_DOCS` |
| `SHIPPING_DOCS` | رفع فاتورة/بوليصة/شهادات | إدارة/مورد | — | `PAYMENT_INSTALLMENTS_PENDING` |
| `PAYMENT_INSTALLMENTS_PENDING` | تفعيل دفعة الشحن (تمر بآلة التحقق المزدوج إن كانت أمانة موجَّهة للمورد) | نظام | — | `IN_TRANSIT` |
| `IN_TRANSIT` | وصول الشحنة | إدارة (تحديث تتبّع) | — | `ARRIVED_PORT` |
| `IN_TRANSIT` | تلف/فقدان أثناء النقل **[إصلاح: تغطية نزاع مفقودة سابقاً]** | عميل/مورد/إدارة | — | `DISPUTE_SHIPPING` |
| `ARRIVED_PORT` | بدء التخليص | إدارة | — | `CUSTOMS_FEE_ADDED` |
| `ARRIVED_PORT` | نزاع شحن (تلف عند الوصول) **[إصلاح]** | عميل/مورد/إدارة | — | `DISPUTE_SHIPPING` |
| `CUSTOMS_FEE_ADDED` | الإدارة تضيف بند رسم (اسم+مبلغ) | إدارة (مشغّل ينشئ، محاسب يعتمد قبل ظهوره للعميل — four-eyes) | `CustomsFee{status=PUBLISHED}` | `CUSTOMS_CUSTOMER_PAYS` |
| `CUSTOMS_CUSTOMER_PAYS` | العميل يدفع ويرفع إثباتاً | عميل | `receipt_fingerprint` بنفس منطق البند 3 | `CUSTOMS_FEE_PROOF_UPLOADED` |
| `CUSTOMS_FEE_PROOF_UPLOADED` | تحقق الإدارة **[إصلاح: كانت غائبة]** | إدارة (محاسب) | — | `CUSTOMS_FEE_VERIFIED` |
| `CUSTOMS_FEE_VERIFIED` | حاجة لرسم إضافي | إدارة | — | `CUSTOMS_FEE_ADDED` |
| `CUSTOMS_FEE_VERIFIED` | لا رسوم إضافية | إدارة | — | `FINAL_DELIVERY` |
| `CUSTOMS_FEE_PROOF_UPLOADED` | إثبات مرفوض/مزوَّر **[إصلاح]** | إدارة (محاسب) | — | `DISPUTE_PAYMENT` |
| أي حالة داخل `CustomsClearance` | نزاع دفع أو شحن | عميل/مورد/إدارة | — | `DISPUTE_PAYMENT` / `DISPUTE_SHIPPING` |
| `FINAL_DELIVERY` | نزاع عند التسليم (بضاعة تالفة/ناقصة) **[إصلاح]** | عميل | — | `DISPUTE_SHIPPING` |
| `FINAL_DELIVERY` | العميل يوقّع الاستلام | عميل | — | `CUSTOMER_SIGNED` |
| `CUSTOMER_SIGNED` | نزاع بعد التوقيع (خلال نافذة زمنية محدودة) **[إصلاح]** | عميل | — | `DISPUTE_QUALITY` أو `DISPUTE_SHIPPING` |
| `CUSTOMER_SIGNED` | تقييم المورد | عميل | `SupplierRating{phase=POST_CONTRACT}` | `SUPPLIER_RATED` |
| `SUPPLIER_RATED` | إغلاق نهائي **[إصلاح: نهائية حقيقية بدل `[*]` غير محدَّدة]** | نظام | — | `COMPLETED` |

---

## 7. جدول النزاعات الموسَّع (بعد سد فجوة تغطية الشحن)

| نوع النزاع | يُفتح من | مسار العودة بعد الحل |
|---|---|---|
| `DISPUTE_PAYMENT` | `CONTRACT_*`, `PAYMENT_PENDING_ADMIN_VERIFICATION`, `CUSTOMS_*` | `resume_target_state` المحفوظة؛ **لا يعني "استرداد الدفعة الأولى المؤكدة" — يقتصر على تصحيح أخطاء تقنية بالمبلغ/الإيصال إلا إذا كان من نوع `DISPUTE_MANDATORY_REFUND`** |
| `DISPUTE_QUALITY` | `PROD_*`, `CUSTOMER_SIGNED` (نافذة محدودة بعد التوقيع) | نفس نقطة التوقف؛ يُعاد فتح Checkpoint المرتبط إن كان هو السبب |
| `DISPUTE_DELAY` | `PROD_*`, `ESCALATION_*` | حسب `checkpoint_type`/`escalation_actor` المحفوظ |
| `DISPUTE_SHIPPING` **[موسّعة]** | `LOADING_SHIPPING`, `ShippingDocs`, `IN_TRANSIT`, `ARRIVED_PORT`, `CustomsClearance`, `FINAL_DELIVERY`, `CUSTOMER_SIGNED` | نفس مرحلة الشحن/التخليص/التسليم المحفوظة |
| `DISPUTE_MANDATORY_REFUND` **[إصلاح]** | أي إلغاء بعد `SUPPLIER_PAYMENT_CONFIRMED` | ينتهي دائماً إلى `CANCELLED` بعد قرار تسوية إداري موثَّق (لا عودة لتشغيل الطلب) |

**قاعدة منع التعليق المزدوج المتماثل**: لا يجوز فتح نزاعين من نفس `Order.id` في آن واحد؛ أي محاولة ثانية تُضاف كـ`DisputeClaim` فرعي على النزاع المفتوح، لا نزاعاً بمعرّف مستقل.

---

## 8. صيغة `resume_target_state`

قيمة نصية مركّبة إلزامية الشكل: `"<PARENT_COMPOSITE>.<SUBSTATE_ID>"` — مثال: `"Production.PROD_CHECKPOINT_1"` أو `"CustomsClearance.CUSTOMS_FEE_ADDED"`. تُكتب **لحظة فتح** أي تعليق (نزاع أو تصعيد)، لا لحظة إغلاقه، لتفادي فقدانها في حال تعليق متداخل (تصعيد نشط ثم نزاع يُفتح فوقه). يُحفَظ كعمود `resume_target_state TEXT` + عمود تحقق `resume_target_state_valid_states` (enum check) يمنع كتابة قيمة لا تطابق `SUBSTATE_ID` معروفاً بجدول الحالات أعلاه.
