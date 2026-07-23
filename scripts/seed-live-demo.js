#!/usr/bin/env node
/**
 * يعبّئ موقع Apex Sourcing الحي (Render) بحسابات وطلبات تجريبية متنوعة الحالات،
 * عبر نداءات HTTP حقيقية لنفس الـAPI الذي تستخدمه البوابات الثلاث — لا يلمس
 * قاعدة البيانات مباشرة، ولا يحتاج أي صلاحية غير حساب الإدارة (ADMIN_OWNER)
 * الموجود فعلاً. مُصمَّم للتشغيل من GitHub Actions (.github/workflows/seed-live-demo.yml)
 * حيث يوجد اتصال إنترنت حقيقي، لكن يعمل بنفس الطريقة من أي جهاز فيه Node.js 18+.
 *
 * قبل التشغيل، لازم تُقصَّر مهلة المزايدة على Render (خطوة مؤقتة لمرة واحدة):
 * من لوحة apex-api على Render -> Environment -> أضف/عدّل المتغير:
 *   BIDDING_DEADLINE_MS = 60000
 * ثم اعمل Manual Deploy (أو انتظر إعادة النشر التلقائية) — بدون هذا التعديل
 * ستبقى بعض الطلبات عالقة عند REG_BIDS_COLLECTING فعلياً 72 ساعة حقيقية قبل
 * أن تتحول تلقائياً، لأن هذا هو السلوك الطبيعي في الإنتاج.
 * بعد انتهاء هذا السكربت، ارجع القيمة لـ 259200000 (3 أيام) أو احذف المتغير
 * كلياً، واعمل Manual Deploy مرة أخرى، حتى تعمل مهلة المزايدة الحقيقية لاحقاً.
 */

const API_BASE = process.env.APEX_API_BASE || 'https://apex-api-3u2c.onrender.com';

const SHARED_PASSWORD = '12345678'; // نفس كلمة مرور حساب الإدارة الحالي، لسهولة التذكر أثناء الاختبار
const OWNER_EMAIL = 'kh.msd2@gmail.com';
const OWNER_PASSWORD = '12345678';

const ACCOUNTS = {
  customer: { email: OWNER_EMAIL, password: SHARED_PASSWORD, name: 'خالد', phone: '0500000000' },
  supplierPrimary: { email: OWNER_EMAIL, password: SHARED_PASSWORD, legalName: 'مؤسسة خالد للاستيراد (حساب المورد الرئيسي)' },
  supplier2: { email: 'supplier2@apex-demo.local', password: SHARED_PASSWORD, legalName: 'Guangzhou Trading Co' },
  supplier3: { email: 'supplier3@apex-demo.local', password: SHARED_PASSWORD, legalName: 'Shenzhen Sourcing Ltd' },
  operator: { email: 'operator@apex-demo.local', password: SHARED_PASSWORD, name: 'مها (مشغّل تجريبي)', role: 'OPERATOR' },
  accountant: { email: 'accountant@apex-demo.local', password: SHARED_PASSWORD, name: 'سارة (محاسب تجريبي)', role: 'ACCOUNTANT' },
};

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* بعض الاستجابات بلا جسم */
  }
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureCustomerToken({ email, password, name, phone }) {
  try {
    const res = await api('POST', '/auth/customer/register', { body: { name, email, phone, password } });
    console.log(`✓ تم إنشاء حساب عميل جديد: ${email}`);
    return res.token;
  } catch (e) {
    if (e.status === 409) {
      const res = await api('POST', '/auth/customer/login', { body: { email, password } });
      console.log(`= حساب العميل موجود مسبقاً، تم تسجيل الدخول: ${email}`);
      return res.token;
    }
    throw e;
  }
}

async function ensureAdminToken(adminToken, { email, password, name, role }) {
  try {
    await api('POST', '/admin/admins', { token: adminToken, body: { name, email, password, role } });
    console.log(`✓ تم إنشاء حساب إدارة جديد (${role}): ${email}`);
  } catch (e) {
    if (e.status !== 409) throw e;
    console.log(`= حساب الإدارة موجود مسبقاً (${role}): ${email}`);
  }
  const login = await api('POST', '/auth/admin/login', { body: { email, password } });
  return login.token;
}

async function ensureSupplierToken(adminToken, { email, password, legalName }) {
  try {
    await api('POST', '/admin/suppliers', { token: adminToken, body: { legalName, contactEmail: email, password } });
    console.log(`✓ تم إنشاء حساب مورد جديد: ${email}`);
  } catch (e) {
    if (e.status !== 409) throw e;
    console.log(`= حساب المورد موجود مسبقاً: ${email}`);
  }
  const login = await api('POST', '/auth/supplier/login', { body: { email, password } });
  return login.token;
}

async function orderState(adminToken, orderId) {
  const order = await api('GET', `/orders/${orderId}`, { token: adminToken });
  return { state: order.current_state, version: order.state_version };
}

async function waitForState(adminToken, orderId, expected, { timeoutMs = 180000, pollMs = 4000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { state } = await orderState(adminToken, orderId);
    if (state === expected) return;
    await sleep(pollMs);
  }
  throw new Error(
    `الطلب ${orderId} لم يصل لحالة ${expected} خلال ${timeoutMs / 1000} ثانية — ` +
      `تأكد أنك قصّرت BIDDING_DEADLINE_MS على Render وأعدت النشر قبل تشغيل هذا السكربت.`,
  );
}

async function createOrder(customerToken) {
  const created = await api('POST', '/orders', { token: customerToken, body: { serviceTypeCode: 'DOOR_TO_DOOR' } });
  return created.id;
}

async function submitOrder(customerToken, orderId) {
  await api('POST', `/orders/${orderId}/submit`, { token: customerToken, body: { expectedStateVersion: 0 } });
}

async function confirmDeposit(adminToken, orderId) {
  const { version } = await orderState(adminToken, orderId);
  await api('POST', `/orders/${orderId}/confirm-deposit`, { token: adminToken, body: { expectedStateVersion: version } });
}

async function approveForBidding(adminToken, orderId) {
  const { version } = await orderState(adminToken, orderId);
  await api('POST', `/orders/${orderId}/approve`, { token: adminToken, body: { expectedStateVersion: version, supplierType: 'REGISTERED' } });
}

async function submitOffer(supplierToken, orderId, fobValueUsd, leadTimeDays) {
  await api('POST', `/bidding/${orderId}/offers`, { token: supplierToken, body: { fobValueUsd, leadTimeDays, terms: `${leadTimeDays} يوم تسليم` } });
}

/** يدفع الطلب حتى REG_BIDS_COLLECTING (منشور، بانتظار العروض أو بعروض مقدَّمة بالفعل). */
async function driveToPublished(adminToken, customerToken, orderId) {
  await submitOrder(customerToken, orderId);
  await confirmDeposit(adminToken, orderId);
  await approveForBidding(adminToken, orderId);
}

/** بعد انتهاء مهلة المزايدة الفعلية (المُقصَّرة بيئياً) وتقديم العروض — يدفع الطلب حتى PAYMENT_PENDING_ADMIN_VERIFICATION، متوقفاً قبل خطوة المطابقة الفعلية عمداً ليجرّبها المستخدم يدوياً. */
async function driveToPaymentVerificationPending(adminToken, customerToken, winningSupplierToken, orderId) {
  await waitForState(adminToken, orderId, 'REG_ADMIN_REVIEW_BIDS');
  let { version } = await orderState(adminToken, orderId);
  await api('POST', `/bidding/${orderId}/review`, {
    token: adminToken,
    body: { expectedStateVersion: version, fxRateUsed: 3.75, fxRateSource: 'SAMA (بيانات تجريبية)', fxReferenceRate: 3.75 },
  });

  const offers = await api('GET', `/bidding/${orderId}/offers/customer-view`, { token: customerToken });
  const winningOffer = offers[0];
  ({ version } = await orderState(adminToken, orderId));
  await api('POST', `/bidding/${orderId}/select/${winningOffer.id}`, { token: customerToken, body: { expectedStateVersion: version } });

  const plan = await api('POST', `/contracts/${orderId}/payment-plan`, {
    token: adminToken,
    body: { installments: [{ label: 'FIRST_PAYMENT', expectedAmountSar: 37500, isTrustFund: true, refundPolicy: 'REFUNDABLE_UNTIL_EVENT' }] },
  });
  const installmentId = plan.installments[0].id;

  ({ version } = await orderState(adminToken, orderId));
  await api('POST', `/contracts/${orderId}/sign`, { token: customerToken, body: { expectedStateVersion: version, signatureRef: 'esign-demo-1' } });

  ({ version } = await orderState(adminToken, orderId));
  const notify = await api('POST', `/payments/${orderId}/notify-transfer`, { token: customerToken, body: { installmentId, expectedStateVersion: version } });
  const paymentId = notify.payment.id;

  ({ version } = await orderState(adminToken, orderId));
  await api('POST', `/payments/${orderId}/receipts`, {
    token: customerToken,
    body: {
      paymentId,
      expectedStateVersion: version,
      fileUrl: 'https://example.com/receipt-demo.pdf',
      bankReferenceNo: `REF-${orderId.slice(0, 8)}`,
      bankName: 'البنك الأهلي (تجريبي)',
      amountClaimed: 37500,
      transferDateClaimed: new Date().toISOString().slice(0, 10),
    },
  });

  ({ version } = await orderState(adminToken, orderId));
  await api('POST', `/payments/${orderId}/verification/start`, { token: adminToken, body: { expectedStateVersion: version } });

  return { paymentId };
}

/** يكمل التحقق الرباعي بالدفعة (four-eyes) ويؤكد استلام المورد، وصولاً لـSUPPLIER_PAYMENT_CONFIRMED (تُكشف الهوية تلقائياً بعدها). */
async function driveToSupplierPaymentConfirmed(adminToken, operatorToken, accountantToken, winningSupplierToken, orderId, paymentId) {
  let { version } = await orderState(adminToken, orderId);
  await api('POST', `/payments/${orderId}/verification/match`, { token: adminToken, body: { paymentId, expectedStateVersion: version } });

  ({ version } = await orderState(adminToken, orderId));
  await api('POST', `/payments/${orderId}/supplier-ack`, { token: winningSupplierToken, body: { expectedStateVersion: version } });

  const accountantProfile = await api('GET', '/auth/admin/me', { token: accountantToken });
  await api('POST', `/payments/${orderId}/admin-verification/propose`, { token: operatorToken, body: { approverId: accountantProfile.id } });

  ({ version } = await orderState(adminToken, orderId));
  const approve = await api('POST', `/payments/${orderId}/admin-verification/approve`, {
    token: accountantToken,
    body: { paymentId, expectedStateVersion: version },
  });
  return approve;
}

/** يدفع الطلب حتى COMPLETED عبر التصنيع/الشحن/التخليص/التقييم بالكامل. */
async function driveToCompleted(adminToken, operatorToken, accountantToken, customerToken, winningSupplierToken, orderId) {
  let { version } = await orderState(adminToken, orderId);

  const designed = await api('POST', `/production/${orderId}/design`, { token: winningSupplierToken, body: { kind: 'image', fileUrl: 'https://example.com/design.png', expectedStateVersion: version } });
  const approvedDesign = await api('POST', `/production/${orderId}/approve`, { token: customerToken, body: { expectedStateVersion: designed.stateVersion } });
  const qc = await api('POST', `/production/${orderId}/qc`, { token: winningSupplierToken, body: { kind: 'image', fileUrl: 'https://example.com/qc.png', expectedStateVersion: approvedDesign.stateVersion } });
  const approvedQc = await api('POST', `/production/${orderId}/approve`, { token: customerToken, body: { expectedStateVersion: qc.stateVersion } });

  const toDocs = await api('POST', `/shipping/${orderId}/advance-to-docs`, { token: adminToken, body: { expectedStateVersion: approvedQc.stateVersion } });
  await api('POST', `/shipping/${orderId}/documents`, { token: adminToken, body: { docType: 'bill_of_lading', fileUrl: 'https://example.com/bol.pdf' } });
  const docsFinalized = await api('POST', `/shipping/${orderId}/documents/finalize`, { token: adminToken, body: { expectedStateVersion: toDocs.stateVersion } });
  const installmentsConfirmed = await api('POST', `/shipping/${orderId}/installments/confirm`, { token: adminToken, body: { expectedStateVersion: docsFinalized.stateVersion } });
  const arrived = await api('POST', `/shipping/${orderId}/arrived`, { token: adminToken, body: { expectedStateVersion: installmentsConfirmed.stateVersion } });

  const customsStarted = await api('POST', `/customs-fees/${orderId}/start`, { token: adminToken, body: { expectedStateVersion: arrived.stateVersion } });
  const fee = await api('POST', `/customs-fees/${orderId}/fees`, { token: operatorToken, body: { label: 'رسوم استيراد', amountSar: 1200 } });
  const feePublished = await api('POST', `/customs-fees/${orderId}/fees/${fee.id}/approve`, { token: accountantToken, body: { expectedStateVersion: customsStarted.stateVersion } });
  const proofUploaded = await api('POST', `/customs-fees/${orderId}/pay-and-upload-proof`, { token: customerToken, body: { fileUrl: 'https://example.com/customs-proof.pdf', expectedStateVersion: feePublished.stateVersion } });
  const feeVerified = await api('POST', `/customs-fees/${orderId}/verify`, { token: adminToken, body: { expectedStateVersion: proofUploaded.stateVersion } });
  const finalDelivery = await api('POST', `/customs-fees/${orderId}/no-more-fees`, { token: adminToken, body: { expectedStateVersion: feeVerified.stateVersion } });

  const signed = await api('POST', `/delivery/${orderId}/sign`, { token: customerToken, body: { expectedStateVersion: finalDelivery.stateVersion } });
  await api('POST', `/ratings/${orderId}`, { token: customerToken, body: { score: 5, notes: 'تجربة توصيل ممتازة (بيانات تجريبية)', expectedStateVersion: signed.stateVersion } });
}

async function main() {
  console.log(`\n=== تعبئة بيانات تجريبية على ${API_BASE} ===\n`);

  console.log('-- الحسابات --');
  const customerToken = await ensureCustomerToken(ACCOUNTS.customer);
  const ownerToken = (await api('POST', '/auth/admin/login', { body: { email: OWNER_EMAIL, password: OWNER_PASSWORD } })).token;
  const operatorToken = await ensureAdminToken(ownerToken, ACCOUNTS.operator);
  const accountantToken = await ensureAdminToken(ownerToken, ACCOUNTS.accountant);
  const supplierPrimaryToken = await ensureSupplierToken(ownerToken, ACCOUNTS.supplierPrimary);
  const supplier2Token = await ensureSupplierToken(ownerToken, ACCOUNTS.supplier2);
  const supplier3Token = await ensureSupplierToken(ownerToken, ACCOUNTS.supplier3);

  const summary = [];

  console.log('\n-- الطلب 1: مسودة (DRAFT) --');
  const order1 = await createOrder(customerToken);
  summary.push({ order: order1, label: 'مسودة لم تُقدَّم بعد', state: 'DRAFT' });

  console.log('-- الطلب 2: مُقدَّم، بانتظار تأكيد العربون (SUBMITTED) --');
  const order2 = await createOrder(customerToken);
  await submitOrder(customerToken, order2);
  summary.push({ order: order2, label: 'مُقدَّم من العميل، بانتظار تأكيد الإدارة لاستلام العربون', state: 'SUBMITTED' });

  console.log('-- الطلب 3: بانتظار مراجعة الإدارة (REVIEW_PENDING) --');
  const order3 = await createOrder(customerToken);
  await submitOrder(customerToken, order3);
  await confirmDeposit(ownerToken, order3);
  summary.push({ order: order3, label: 'العربون مؤكَّد، بانتظار اعتماد/رفض الإدارة', state: 'REVIEW_PENDING' });

  console.log('-- الطلب 4: منشور للمزايدة، بلا عروض بعد (REG_BIDS_COLLECTING) --');
  const order4 = await createOrder(customerToken);
  await driveToPublished(ownerToken, customerToken, order4);
  summary.push({ order: order4, label: 'منشور على لوحة المزايدة، لا عروض عليه بعد', state: 'REG_BIDS_COLLECTING' });

  console.log('-- الطلب 5: مزايدة نشطة بثلاثة عروض متنافسة (REG_BIDS_COLLECTING) --');
  const order5 = await createOrder(customerToken);
  await driveToPublished(ownerToken, customerToken, order5);
  await submitOffer(supplierPrimaryToken, order5, 10000, 30);
  await submitOffer(supplier2Token, order5, 9500, 25);
  await submitOffer(supplier3Token, order5, 10500, 20);
  summary.push({ order: order5, label: 'ثلاثة عروض حقيقية من ثلاثة موردين مختلفين، بانتظار انتهاء مهلة المزايدة', state: 'REG_BIDS_COLLECTING (3 عروض)' });

  const skipDeep = process.env.SKIP_DEEP_ORDERS === 'true';
  if (skipDeep) {
    console.log('\n(SKIP_DEEP_ORDERS=true — تخطّي الطلبات 6-8 التي تحتاج مهلة مزايدة مُقصَّرة)\n');
  } else {
    console.log('-- الطلب 6: بانتظار التحقق الإداري من الدفعة (PAYMENT_PENDING_ADMIN_VERIFICATION) --');
    const order6 = await createOrder(customerToken);
    await driveToPublished(ownerToken, customerToken, order6);
    await submitOffer(supplierPrimaryToken, order6, 10000, 30);
    await driveToPaymentVerificationPending(ownerToken, customerToken, supplierPrimaryToken, order6);
    summary.push({ order: order6, label: 'دفعة مرفوعة من العميل، بانتظار خطوة "مطابقة" ثم اعتماد رباعي (four-eyes) — أكملها يدوياً من بوابة الإدارة', state: 'PAYMENT_PENDING_ADMIN_VERIFICATION' });

    console.log('-- الطلب 7: نزاع دفع إلزامي مفتوح (DISPUTE_MANDATORY_REFUND) --');
    const order7 = await createOrder(customerToken);
    await driveToPublished(ownerToken, customerToken, order7);
    await submitOffer(supplier2Token, order7, 9800, 28);
    const { paymentId: order7PaymentId } = await driveToPaymentVerificationPending(ownerToken, customerToken, supplier2Token, order7);
    await driveToSupplierPaymentConfirmed(ownerToken, operatorToken, accountantToken, supplier2Token, order7, order7PaymentId);
    {
      const { version } = await orderState(ownerToken, order7);
      const cancel = await api('POST', `/disputes/${order7}/admin-cancel`, { token: ownerToken, body: { expectedStateVersion: version } });
      if (cancel.toState !== 'DISPUTE_MANDATORY_REFUND') throw new Error(`order7 expected DISPUTE_MANDATORY_REFUND, got ${cancel.toState}`);
      const accountantProfile = await api('GET', '/auth/admin/me', { token: accountantToken });
      await api('POST', `/disputes/${order7}/mandatory-refund/propose`, { token: ownerToken, body: { approverId: accountantProfile.id } });
    }
    summary.push({ order: order7, label: 'نزاع دفع إلزامي مفتوح — اقتراح تسوية مُقدَّم من المالك، بانتظار اعتماد حساب "المحاسب" التجريبي', state: 'DISPUTE_MANDATORY_REFUND' });

    console.log('-- الطلب 8: مكتمل بالكامل (COMPLETED) --');
    const order8 = await createOrder(customerToken);
    await driveToPublished(ownerToken, customerToken, order8);
    await submitOffer(supplier3Token, order8, 11000, 22);
    const { paymentId: order8PaymentId } = await driveToPaymentVerificationPending(ownerToken, customerToken, supplier3Token, order8);
    await driveToSupplierPaymentConfirmed(ownerToken, operatorToken, accountantToken, supplier3Token, order8, order8PaymentId);
    await driveToCompleted(ownerToken, operatorToken, accountantToken, customerToken, supplier3Token, order8);
    summary.push({ order: order8, label: 'مسار كامل منتهٍ فعلياً من الألف للياء، بتقييم 5 نجوم', state: 'COMPLETED' });
  }

  console.log('\n\n================= ملخص نهائي =================\n');
  console.log('الروابط:');
  console.log('  الصفحة الرئيسية: https://apex-web-landing.onrender.com');
  console.log('  بوابة العميل : https://apex-web-customer.onrender.com');
  console.log('  بوابة المورد : https://apex-web-supplier.onrender.com');
  console.log('  بوابة الإدارة: https://apex-web-admin.onrender.com\n');

  console.log('الحسابات:');
  console.log(`  إدارة (OWNER)      : ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);
  console.log(`  إدارة (OPERATOR)   : ${ACCOUNTS.operator.email} / ${ACCOUNTS.operator.password}`);
  console.log(`  إدارة (ACCOUNTANT) : ${ACCOUNTS.accountant.email} / ${ACCOUNTS.accountant.password}`);
  console.log(`  عميل               : ${ACCOUNTS.customer.email} / ${ACCOUNTS.customer.password}`);
  console.log(`  مورد رئيسي         : ${ACCOUNTS.supplierPrimary.email} / ${ACCOUNTS.supplierPrimary.password}`);
  console.log(`  مورد تجريبي 2      : ${ACCOUNTS.supplier2.email} / ${ACCOUNTS.supplier2.password}`);
  console.log(`  مورد تجريبي 3      : ${ACCOUNTS.supplier3.email} / ${ACCOUNTS.supplier3.password}\n`);

  console.log('الطلبات:');
  for (const s of summary) {
    console.log(`  ${s.order}  ->  ${s.state}\n      ${s.label}`);
  }
  console.log('\n=================================================\n');
}

main().catch((err) => {
  console.error('\n✗ توقف السكربت بسبب خطأ:\n', err.message);
  process.exit(1);
});
