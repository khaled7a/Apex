-- Up Migration

-- fx_rate_deviation_flag has existed on `order` since the original schema
-- (docs/data-model.md §1: "انحراف > حد معيّن عن سعر مرجعي ⇒ يتطلب اعتماد
-- OWNER إضافي") but was never actually computed or enforced anywhere —
-- discovered during review. These two columns record who satisfied that
-- additional-OWNER-approval requirement and when, so bidding.service.ts can
-- block offer selection on a flagged order until an OWNER has signed off.
ALTER TABLE "order" ADD COLUMN fx_rate_deviation_approved_by uuid REFERENCES admin_user(id);
ALTER TABLE "order" ADD COLUMN fx_rate_deviation_approved_at TIMESTAMPTZ;

-- Down Migration

ALTER TABLE "order" DROP COLUMN IF EXISTS fx_rate_deviation_approved_at;
ALTER TABLE "order" DROP COLUMN IF EXISTS fx_rate_deviation_approved_by;
