# نموذج البيانات (Data Model)

هذا المستند يبني على `docs/state-machine.md` ويحوّل قسم "الكيانات الأساسية" في `apex_platform_project_brief.md` إلى نموذج بيانات كامل، مع تضمين كل إصلاحات المراجعة النقدية (خصوصاً: فصل `is_refundable` الثلاثي، سجل تدقيق append-only بسلسلة hash، مصفوفة RBAC مفصَّلة، مرجع دفع فريد لمنع تكرار الإيصالات، حوكمة سعر الصرف). الستاك المقترح **PostgreSQL** (مبرَّر أدناه) لكن النموذج منطقي وقابل للنقل لأي RDBMS.

لماذا PostgreSQL تحديداً: دعم `ENUM` أصلي لآلة الحالة، `JSONB` لحمولات سجل التدقيق المرنة، قيود `CHECK`/`EXCLUDE` قوية لفرض قواعد مالية على مستوى القاعدة لا التطبيق فقط، وصلاحيات دقيقة على مستوى الجدول (`REVOKE UPDATE, DELETE`) لفرض append-only حقيقي على `audit_log` — وهذا تحديداً ما توصي به المراجعة (لا تكتفِ بانضباط الكود).

---

## 1. المستخدمون والأدوار

### `Customer`
العميل. حقول أساسية: `id`, `name`, `company_name`, `phone` (داخلي/تحقق فقط، لا يُعرض لأي مورد أبداً), `email`, `national_id/cr_number`, `created_at`.

### `AdminUser`
موظف الإدارة. `id`, `name`, `email`, `role` (`OWNER` / `OPERATOR` / `ACCOUNTANT`), `is_active`, `mfa_enabled` (إلزامي لكل من `OWNER`/`ACCOUNTANT`).

### مصفوفة الصلاحيات الفعلية (كانت غير معرَّفة في الوثيقة الأصلية — هذا هو الحسم المطلوب)

| الإجراء | OWNER | OPERATOR | ACCOUNTANT | قيد four-eyes |
|---|:---:|:---:|:---:|---|
| اعتماد/تعديل/رفض الطلب | ✅ | ✅ | ❌ | — |
| اعتماد مورد خارجي (نهائي) | ✅ | ⚙️ يتحقق فقط | ❌ | مشغّل يتحقق ≠ مالك يعتمد |
| اعتماد عرض قبل عرضه للعميل + إدخال `fx_rate_used` | ✅ | ✅ | ❌ | انحراف > حد معيّن عن سعر مرجعي ⇒ يتطلب اعتماد `OWNER` إضافي |
| التحقق من إيصال بنكي عادي | ✅ | ✅ | ✅ (تحقق نهائي) | مُنشئ الإيصال (لو موظف رفعه نيابة) ≠ من يتحقق |
| **التحقق مع المورد + قفل عدم الاسترجاع (`PAYMENT_PENDING_ADMIN_VERIFICATION`)** | ✅ | ⚙️ يبدأ فقط | ✅ (يعتمد نهائياً) | إلزامي: `OPERATOR` يبدأ + `ACCOUNTANT` أو `OWNER` يعتمد نهائياً — **لا يعتمد نفس الشخص الذي أنشأ العرض/التحقق من الإيصال الأول** |
| إدخال/تعديل رسوم التخليص | ✅ | ✅ ينشئ | ✅ يعتمد قبل النشر للعميل | إلزامي |
| حل نزاع مالي عادي | ✅ | ❌ | ✅ (توصية) | يقرر `OWNER`، ولا يجوز أن يكون طرفاً في الحدث المتنازَع عليه |
| حل `DISPUTE_MANDATORY_REFUND` | ✅ | ❌ | ✅ | إلزامي: `OWNER` + `ACCOUNTANT` معاً |
| رؤية هامش الربح الفعلي / `SalaryAccrual` | ✅ | ❌ | ✅ | القيم الظاهرة للمشغّل تقتصر على ما يظهر للعميل/المورد فقط |
| الموافقة على تجديد اتفاقية (جانب الإدارة) | ✅ | ❌ | ❌ | + موافقة المورد (خارج نظام الإدارة) |
| استخدام صلاحية استثنائية (Override) | ✅ | ❌ | ❌ | يُسجَّل تلقائياً `override_used=true` + سبب إلزامي + تصعيد لتقرير دوري |

**قاعدة برمجية صريحة**: `approver_id != submitter_id` على كل صف يتطلب four-eyes — يُفرض بقيد `CHECK` على جدول `financial_approval`.

---

## 2. الموردون

### `SupplierCategory`
`id`, `name` (أثاث/مواد بناء/كماليات...). علاقة متعددة-لمتعددة مع `RegisteredSupplier` عبر `supplier_category_map` — **بلا أي دور بوابة (gate) في النشر** (قرار معتمد: النشر مفتوح دائماً)؛ الفئة بيانات وصفية/تنافسية على ملف المورد فقط.

### `RegisteredSupplier`
`id`, `legal_name` (لا يُعرض للعميل إلا بعد `IdentityRevealed`), `display_code` (مورد A/B/C — يُولَّد عشوائياً لكل طلب، لا ثابتاً لكل مورد، لمنع الربط عبر طلبات متعددة), `is_active`, `bank_account_ref` (مشفَّر)، `created_at`.

### `ExternalSupplier`
`id`, `order_id` (كل مورد خارجي مرتبط بطلب عميل محدد جاء به), `legal_name`, `license_number`, `years_active`, `verification_source` (`aiqicha`/`qcc`/يدوي), `vetting_status`, `vetted_by`, `vetted_at`.

### `SupplierRating`
`id`, `supplier_type` (`REGISTERED`/`EXTERNAL`), `supplier_id`, `order_id` (nullable لتقييم ما قبل التعاقد), `phase` (`PRE_CONTRACT` من الإدارة / `POST_CONTRACT` من العميل), `rated_by`, `score`, `notes`, `created_at`.

---

## 3. الطلب وإعدادات الخدمة

### `ServiceType`
كيان إعدادات قابل للتوسعة (وليس enum مقفل) — يحل مشكلة "قد تكون هناك تنويعات أكثر من 3":
`id`, `code` (`DOOR_TO_DOOR`/`SHIPPING_CLEARANCE_ONLY`/`EXTERNAL_SUPPLIER_SERVICE`/...), `label_ar`, `commission_rate_percent`, `includes_sourcing` (bool), `includes_identity_management` (bool), `includes_production_oversight` (bool), `includes_customs_clearance` (bool), `description_included_ar`, `description_excluded_ar`, `is_active`.

### `Order`
الكيان المركزي. حقول الحوكمة الإلزامية (من القسم 4.1 في الوثيقة الأصلية + إضافات المراجعة):

| الحقل | النوع | ملاحظة |
|---|---|---|
| `id` | UUID | — |
| `customer_id` | FK | — |
| `service_type_id` | FK → ServiceType | يُحدَّد نهائياً وقت اعتماد الإدارة |
| `supplier_type` | ENUM(`REGISTERED`,`EXTERNAL`,`NONE`) | `NONE` لحالة `SHIPPING_CLEARANCE_ONLY` |
| `registered_supplier_id` / `external_supplier_id` | FK nullable | أحدهما فقط غير NULL حسب `supplier_type` (قيد CHECK) |
| `current_state` | ENUM | من جدول الحالات في `state-machine.md` |
| `state_version` | INTEGER | للقفل التفاؤلي |
| `hold_type` | ENUM(`NONE`,`ESCALATION`,`DISPUTE`) nullable | مستقل عن `current_state` |
| `active_dispute_id` | FK nullable | يمنع فتح نزاع ثانٍ متزامن (قيد فريد جزئي) |
| `resume_target_state` | TEXT nullable | صيغة `"<COMPOSITE>.<SUBSTATE>"` — تُكتب لحظة الدخول للتعليق |
| `entered_at` / `exited_at` | لكل انتقال — تُسجَّل فعلياً في `state_transition_log` لا كعمودين وحيدين على `Order` (انظر §7) | |
| `financial_commitment_started_at` | TIMESTAMPTZ nullable | يُكتب مرة واحدة فقط، أول `SUPPLIER_PAYMENT_CONFIRMED` |
| `fx_rate_used` | NUMERIC(12,6) nullable | |
| `fx_rate_source` | TEXT | **إلزامي عند تعبئة `fx_rate_used`** — مرجع/رابط/لقطة سعر السوق وقتها |
| `fx_rate_entered_by` | FK → AdminUser | |
| `fx_rate_deviation_flag` | bool | `true` تلقائياً إن انحرف > X% عن سعر مرجعي خارجي مسحوب تلقائياً كـ tripwire |
| `fob_value_usd` / `final_value_sar` | NUMERIC | |
| `low_competition_offer` | bool | يُعلَّم إن كان عرض واحد فقط ورد بالمزايدة |
| `created_at` | | |

**قيد فريد جزئي مهم**: `UNIQUE (id) WHERE hold_type = 'DISPUTE'` على جدول ربط منفصل (`order_active_dispute`) لمنع نزاعين نشطين على نفس الطلب فعلياً على مستوى القاعدة لا التطبيق فقط.

### `AgreementRenewal`
`id`, `order_id`, `renewal_of_agreement_id` (يشير لنفسه أو لعقد سابق — سلسلة قابلة للتتبع عبر أكثر من تجديد), `requested_at`, `supplier_decision` (`PENDING`/`APPROVED`/`DECLINED`), `supplier_decided_at`, `admin_decision`, `admin_decided_by`, `admin_decided_at`.

---

## 4. المزايدة والعقد

### `Offer`
`id`, `order_id`, `registered_supplier_id`, `fob_value_usd`, `lead_time_days`, `terms`, `submitted_at`, `admin_review_status`. **عزل بيانات**: أي استعلام لعرض العروض لمورد معيّن يُفلتَر إلزامياً بـ `supplier_id = current_supplier_session_id` على مستوى طبقة الوصول للبيانات (Row-Level Security في PostgreSQL)، لا فقط منطق تطبيق — هذا يمنع تسريب عرض منافس حتى عبر خطأ برمجي مستقبلي.

### `Contract`
`id`, `order_id`, `type` (`STANDARD`/`LOGISTICS_ONLY`), `signed_at`, `signature_ref` (مزوّد توقيع إلكتروني خارجي), `terms_snapshot` (JSONB — نسخة مجمَّدة من الشروط وقت التوقيع، لا مرجعاً حياً قد يتغيّر).

### `PaymentPlan`
`id`, `contract_id`, `created_by`, `created_at`, `total_installments`.

### `PaymentInstallment`
سجل خطة الدفع (ما هو **متوقَّع**)، منفصل عن `Payment` (ما **حدث فعلياً**):
`id`, `payment_plan_id`, `sequence_no`, `label` (عربون/دفعة أولى/دفعة تصنيع/رسم تخليص...), `expected_amount_sar`, `is_trust_fund` (bool — موجَّهة لمورد أم إيراد شركة), `refund_policy` (ENUM — انظر §5), `unique_payment_reference` (UPR يُولَّد قبل التحويل، يُطلب كتابته في بيان الحوالة), `due_stage` (أي حالة من `state-machine.md` تُفعِّل طلب هذه الدفعة).

---

## 5. الدفعات والاسترجاع — الإصلاح الجوهري لـ `is_refundable`

المراجعة رصدت أن Boolean واحد يناقض نفسه (قاعدة "ثابت وقت الإنشاء" تصطدم بواقع دفعة تتغيّر قابليتها للاسترجاع بعد حدث لاحق). الحل: **ثلاثة مفاهيم منفصلة**:

### `Payment`
الحدث المالي الفعلي (تحويل واحد وقع فعلاً):
`id`, `installment_id`, `amount_sar`, `paid_at` (تاريخ إشعار العميل), `refund_policy` (ENUM: `NEVER_REFUNDABLE` / `REFUNDABLE_UNTIL_EVENT` / `REFUNDABLE_BY_DISPUTE_ONLY`) — **يُكتب وقت الإنشاء ولا يتغيّر أبداً بعدها (immutable فعلياً بقيد DB)**.
`current_refundability_status` (ENUM مشتق يتغيّر: `REFUNDABLE` → `LOCKED`) — هذا هو الحقل الذي يتغيّر مع الأحداث (مثل `PAYMENT_PENDING_ADMIN_VERIFICATION → SUPPLIER_PAYMENT_CONFIRMED`)، بينما `refund_policy` الأصلي يبقى سليماً للتدقيق التاريخي.

### `Receipt`
`id`, `payment_id`, `file_url`, `bank_reference_no` (حقل منظَّم إلزامي — لا صورة فقط), `bank_name`, `amount_claimed`, `transfer_date_claimed`, `receipt_fingerprint` = `hash(bank_reference_no || amount || transfer_date)`, **`UNIQUE(receipt_fingerprint)` على مستوى القاعدة بالكامل عبر كل الطلبات** — يمنع فعلياً استخدام نفس الإيصال لتغطية أكثر من التزام، `perceptual_hash` (لصورة الإيصال نفسها، لالتقاط نفس الصورة بجودة ضغط مختلفة), `ocr_extracted_fields` (JSONB), `verification_status`, `verified_by`, `verified_at`, `rejection_reason`.

### `RefundTransaction`
سجل مستقل لأي استرجاع فعلي وقع لاحقاً بقرار نزاع — **لا يُعدَّل `Payment.refund_policy` الأصلي أبداً**:
`id`, `payment_id`, `dispute_id`, `refunded_amount_sar`, `refund_ratio` (نسبة من الأصل), `decided_by` (يتطلب اعتمادين — `OWNER`+`ACCOUNTANT`), `decided_at`, `reason`.

هذا يحل تعارض "رسوم التخليص لا تُرد إلا بقرار نزاع صريح": `refund_policy = REFUNDABLE_BY_DISPUTE_ONLY` يبقى ثابتاً، والاسترجاع الفعلي (إن حدث) يظهر في `RefundTransaction` كحركة لاحقة مستقلة تماماً — لا كسر لأي تقرير ربحية سابق بُني على القيمة الأصلية.

---

## 6. الشحن والتخليص

### `ShippingDocument`
`id`, `order_id`, `type` (فاتورة/بوليصة/شهادة منشأ...), `file_url`, `uploaded_by`, `uploaded_at`.

### `CustomsFee`
`id`, `order_id`, `label` (ميناء/فحص/نقل/تخزين/أخرى — نص حر), `amount_sar`, `created_by`, `approved_by` (four-eyes قبل النشر للعميل), `status` (`DRAFT`→`PUBLISHED`→`PAID`→`VERIFIED`), `linked_payment_id`.

---

## 7. سجل الانتقالات وسجل التدقيق

### `state_transition_log`
سجل تاريخي كامل لكل انتقال فعلي (بديل عن `entered_at`/`exited_at` كعمودين وحيدين على `Order`، لأن الطلب يمر بعشرات الانتقالات):
`id`, `order_id`, `from_state`, `to_state`, `event`, `acted_by_role`, `acted_by_id`, `entered_at`, `exited_at` (يُملأ عند الانتقال التالي), `payload` (JSONB).

### `AuditLog` — append-only حقيقي، لا اتفاق إجرائي فقط
`id` (BIGSERIAL تصاعدي صارم), `entity_type`, `entity_id`, `action`, `actor_id`, `actor_role`, `state_before` (JSONB), `state_after` (JSONB), `ip_address`, `occurred_at` (server-side `now()` فقط، **رفض أي قيمة من العميل**), `prev_hash`, `record_hash` = `sha256(payload || prev_hash)`.

**فرض append-only على مستوى القاعدة لا التطبيق فقط**:
```sql
REVOKE UPDATE, DELETE ON audit_log FROM app_role;
GRANT INSERT, SELECT ON audit_log TO app_role;
```
بالإضافة لتصدير دوري (يومي) لـ`record_hash` الأخير إلى مخزن خارج سيطرة أي مدير قاعدة بيانات داخلي (anchoring خارجي) — تفصيل تشغيلي خارج نطاق الـSchema لكنه ضروري لقيمته الإثباتية القانونية.

**أحداث إلزامية بالتسجيل (موسَّعة عن القائمة الأصلية الناقصة)**: كل ما في الوثيقة الأصلية + `fx_rate_used` (إدخال/تعديل), إنشاء/تعديل/حذف `CustomsFee`, أي تغيير على `current_refundability_status`, `IDENTITY_REVEALED`, كل خطوة من آلة التحقق المزدوج للدفعات (`PAYMENT_PENDING_SUPPLIER_ACK`→`PAYMENT_PENDING_ADMIN_VERIFICATION`→`SUPPLIER_PAYMENT_CONFIRMED`), رفض إيصال (وليس فقط قبوله), نتيجة `SupplierRating`.

---

## 8. النزاعات

### `Dispute`
`id`, `order_id`, `type` (`PAYMENT`/`QUALITY`/`DELAY`/`SHIPPING`/`MANDATORY_REFUND`), `opened_by_role`, `opened_at`, `resume_target_state_snapshot` (نسخة عن قيمة `Order.resume_target_state` وقت الفتح تحديداً — للتدقيق حتى لو تغيّر لاحقاً), `status` (`OPEN`/`RESOLVED`), `resolved_by`, `resolved_at`, `resolution_notes`.

### `DisputeClaim`
لدعم "نزاع أثناء نزاع" بلا نزاع مستقل ثانٍ (قرار معماري من `state-machine.md` §0.3): `id`, `dispute_id`, `raised_by`, `raised_at`, `description`, `status`.

---

## 9. المحاسبة الداخلية (منفصلة تماماً عن أموال الأمانة)

### `CompanyExpense`
`id`, `category`, `amount_sar`, `incurred_at`, `notes`. **بلا أي علاقة FK لـ `Order`/`Payment`** — منفصل فيزيائياً/منطقياً لضمان عدم تسريب بيانات مصاريف داخلية لتقارير عميل/مورد.

### `SalaryAccrual`
`id`, `employee_ref`, `period`, `accrued_amount_sar`, `is_actually_disbursed` (bool — يميّز الاستحقاقي عن النقدي فعلياً). صلاحية القراءة: `OWNER`+`ACCOUNTANT` فقط (مطابق لمصفوفة §1).

---

## 10. علاقات مختصرة (ERD نصي)

```
Customer 1──* Order
Order *──1 ServiceType
Order *──0..1 RegisteredSupplier
Order *──0..1 ExternalSupplier
Order 1──* Offer (RegisteredPath فقط)
Order 1──1 Contract
Contract 1──1 PaymentPlan
PaymentPlan 1──* PaymentInstallment
PaymentInstallment 1──* Payment
Payment 1──1 Receipt
Payment 1──* RefundTransaction
Order 1──* ShippingDocument
Order 1──* CustomsFee
Order 1──* AgreementRenewal
Order 1──0..1 Dispute (نشط، مفروض بقيد فريد جزئي)
Order 1──* Dispute (تاريخياً)
Dispute 1──* DisputeClaim
Order 1──* state_transition_log
* (كل الكيانات) ──* AuditLog (عبر entity_type/entity_id متعدد الأشكال)
RegisteredSupplier *──* SupplierCategory
Order/RegisteredSupplier/ExternalSupplier 1──* SupplierRating
```

انظر `docs/schema.sql` للتنفيذ الفعلي (DDL) على PostgreSQL.
