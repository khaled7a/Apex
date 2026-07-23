import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely } from 'kysely';
import { ActorRef, ADMIN_ACTIONABLE_STATES, OrderState } from '@apex/domain';
import { KYSELY } from '../database/database.module';
import { DB, HoldType } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { TransitionEngineService } from '../transition-engine/transition-engine.service';
import { ApproveOrderDto } from './dto/approve-order.dto';
import { AppConfig } from '../config/configuration';
import { ADMIN_QUEUE_CATEGORY } from './admin-queue-category.const';

export interface ListAllOrdersFilters {
  state?: string;
  holdType?: string;
  customerId?: string;
  supplierId?: string;
  page?: number;
  pageSize?: number;
}

const SYSTEM: ActorRef = { role: 'SYSTEM', id: null };

@Injectable()
export class OrdersService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
    private readonly engine: TransitionEngineService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async createDraft(customerId: string, serviceTypeCode: string) {
    const trx = this.uow.getClient();
    const serviceType = await trx
      .selectFrom('service_type')
      .select(['id'])
      .where('code', '=', serviceTypeCode)
      .executeTakeFirst();
    if (!serviceType) {
      throw new NotFoundException(`unknown service type code: ${serviceTypeCode}`);
    }
    return trx
      .insertInto('order')
      .values({ customer_id: customerId, service_type_id: serviceType.id })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async get(orderId: string) {
    const trx = this.uow.getClient();
    const order = await trx.selectFrom('order').selectAll().where('id', '=', orderId).executeTakeFirst();
    if (!order) throw new NotFoundException(`order ${orderId} not found`);
    return order;
  }

  async listMine(customerId: string) {
    const trx = this.uow.getClient();
    return trx
      .selectFrom('order')
      .select(['id', 'service_type_id', 'current_state', 'hold_type', 'created_at', 'final_value_sar'])
      .where('customer_id', '=', customerId)
      .orderBy('created_at', 'desc')
      .execute();
  }

  /**
   * The supplier-side equivalent of listMine — orders this supplier has
   * actually won (registered_supplier_id set at offer-selection time). Before
   * that point an order the supplier bid on lives in the bidding board
   * instead (GET /bidding/board), not here.
   */
  async listAssignedToSupplier(supplierId: string) {
    const trx = this.uow.getClient();
    return trx
      .selectFrom('order')
      .select(['id', 'service_type_id', 'current_state', 'hold_type', 'created_at', 'final_value_sar'])
      .where('registered_supplier_id', '=', supplierId)
      .orderBy('created_at', 'desc')
      .execute();
  }

  /**
   * One aggregated read across every table the order-detail hub needs, so
   * the frontend doesn't fire 8-10 separate requests per page load. RLS
   * already scopes every joined table by actor, but customer_id is checked
   * explicitly too (defense in depth, not sole reliance on RLS) — a
   * mismatch is reported as 404, not 403, to avoid confirming the order id
   * exists at all to a customer who doesn't own it.
   */
  async getDetailForCustomer(orderId: string, customerId: string) {
    const trx = this.uow.getClient();
    const order = await trx.selectFrom('order').selectAll().where('id', '=', orderId).executeTakeFirst();
    if (!order || order.customer_id !== customerId) {
      throw new NotFoundException(`order ${orderId} not found`);
    }

    const [contract, productionUpdates, shippingDocuments, customsFees, disputes, escalations, renewals, timeline] = await Promise.all([
      trx.selectFrom('contract').selectAll().where('order_id', '=', orderId).executeTakeFirst(),
      trx.selectFrom('production_update').selectAll().where('order_id', '=', orderId).orderBy('posted_at', 'asc').execute(),
      trx.selectFrom('shipping_document').selectAll().where('order_id', '=', orderId).orderBy('uploaded_at', 'asc').execute(),
      trx.selectFrom('customs_fee').selectAll().where('order_id', '=', orderId).execute(),
      trx.selectFrom('dispute').selectAll().where('order_id', '=', orderId).execute(),
      trx.selectFrom('escalation').selectAll().where('order_id', '=', orderId).execute(),
      trx.selectFrom('agreement_renewal').selectAll().where('order_id', '=', orderId).execute(),
      trx.selectFrom('state_transition_log').selectAll().where('order_id', '=', orderId).orderBy('id', 'asc').execute(),
    ]);

    const disputeClaims = disputes.length
      ? await trx
          .selectFrom('dispute_claim')
          .selectAll()
          .where(
            'dispute_id',
            'in',
            disputes.map((d) => d.id),
          )
          .execute()
      : [];

    const paymentPlan = contract ? await trx.selectFrom('payment_plan').selectAll().where('contract_id', '=', contract.id).executeTakeFirst() : undefined;
    const installments = paymentPlan
      ? await trx.selectFrom('payment_installment').selectAll().where('payment_plan_id', '=', paymentPlan.id).orderBy('sequence_no', 'asc').execute()
      : [];
    const payments = installments.length
      ? await trx
          .selectFrom('payment')
          .selectAll()
          .where(
            'installment_id',
            'in',
            installments.map((i) => i.id),
          )
          .execute()
      : [];
    const receipts = payments.length
      ? await trx
          .selectFrom('receipt')
          .selectAll()
          .where(
            'payment_id',
            'in',
            payments.map((p) => p.id),
          )
          .execute()
      : [];

    return {
      order,
      contract,
      paymentPlan,
      installments,
      payments,
      receipts,
      productionUpdates,
      shippingDocuments,
      customsFees,
      disputes,
      disputeClaims,
      escalations,
      renewals,
      timeline,
    };
  }

  /**
   * Supplier equivalent of getDetailForCustomer — deliberately narrower:
   * never joins the `customer` table at all (docs/schema.sql: customer.phone
   * is "never shown to any supplier", and there's no RLS on `customer` to
   * fall back on, so simply not querying it is the safeguard), and omits
   * shipping_document/customs_fee/receipt — those RLS read policies are
   * customer-only by explicit design (see 1700000000018's comment on
   * customs_fee_read/shipping_document_read), and a supplier's role in the
   * order is effectively done by the time those become relevant.
   */
  async getDetailForSupplier(orderId: string, supplierId: string) {
    const trx = this.uow.getClient();
    const order = await trx.selectFrom('order').selectAll().where('id', '=', orderId).executeTakeFirst();
    if (!order || order.registered_supplier_id !== supplierId) {
      throw new NotFoundException(`order ${orderId} not found`);
    }

    const [contract, productionUpdates, disputes, escalations, renewals, timeline] = await Promise.all([
      trx.selectFrom('contract').selectAll().where('order_id', '=', orderId).executeTakeFirst(),
      trx.selectFrom('production_update').selectAll().where('order_id', '=', orderId).orderBy('posted_at', 'asc').execute(),
      trx.selectFrom('dispute').selectAll().where('order_id', '=', orderId).execute(),
      trx.selectFrom('escalation').selectAll().where('order_id', '=', orderId).execute(),
      trx.selectFrom('agreement_renewal').selectAll().where('order_id', '=', orderId).execute(),
      trx.selectFrom('state_transition_log').selectAll().where('order_id', '=', orderId).orderBy('id', 'asc').execute(),
    ]);

    const disputeClaims = disputes.length
      ? await trx
          .selectFrom('dispute_claim')
          .selectAll()
          .where(
            'dispute_id',
            'in',
            disputes.map((d) => d.id),
          )
          .execute()
      : [];

    const paymentPlan = contract ? await trx.selectFrom('payment_plan').selectAll().where('contract_id', '=', contract.id).executeTakeFirst() : undefined;
    const installments = paymentPlan
      ? await trx.selectFrom('payment_installment').selectAll().where('payment_plan_id', '=', paymentPlan.id).orderBy('sequence_no', 'asc').execute()
      : [];

    return { order, contract, paymentPlan, installments, productionUpdates, disputes, disputeClaims, escalations, renewals, timeline };
  }

  /**
   * Before this, an admin could only act on an order they already knew the
   * UUID of — GET /orders/:id existed but there was no way to browse or
   * search. Capped pageSize (never trust a caller-supplied limit as-is).
   */
  async listAll(filters: ListAllOrdersFilters) {
    const trx = this.uow.getClient();
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));

    let query = trx.selectFrom('order').selectAll();
    let countQuery = trx.selectFrom('order').select((eb) => eb.fn.countAll().as('count'));
    if (filters.state) {
      query = query.where('current_state', '=', filters.state as OrderState);
      countQuery = countQuery.where('current_state', '=', filters.state as OrderState);
    }
    if (filters.holdType) {
      query = query.where('hold_type', '=', filters.holdType as HoldType);
      countQuery = countQuery.where('hold_type', '=', filters.holdType as HoldType);
    }
    if (filters.customerId) {
      query = query.where('customer_id', '=', filters.customerId);
      countQuery = countQuery.where('customer_id', '=', filters.customerId);
    }
    if (filters.supplierId) {
      query = query.where('registered_supplier_id', '=', filters.supplierId);
      countQuery = countQuery.where('registered_supplier_id', '=', filters.supplierId);
    }

    const [rows, countResult] = await Promise.all([
      query
        .orderBy('created_at', 'desc')
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .execute(),
      countQuery.executeTakeFirstOrThrow(),
    ]);

    return { rows, total: Number(countResult.count), page, pageSize };
  }

  /**
   * ADMIN_QUEUE_CATEGORY (curated, deliberately narrower than
   * ADMIN_ACTIONABLE_STATES — see that file's comment) drives both the
   * WHERE clause and the per-row category annotation the dashboard tabs on.
   */
  async listNeedsAdminAction() {
    const trx = this.uow.getClient();
    const states = Object.keys(ADMIN_QUEUE_CATEGORY) as OrderState[];
    const rows = await trx
      .selectFrom('order')
      .select(['id', 'service_type_id', 'current_state', 'hold_type', 'created_at', 'final_value_sar', 'customer_id'])
      .where('current_state', 'in', states)
      .orderBy('created_at', 'asc')
      .execute();
    return rows.map((row) => ({ ...row, category: ADMIN_QUEUE_CATEGORY[row.current_state] }));
  }

  /**
   * The most permissive of the three detail reads — admin is allowed to see
   * everything, including customer PII (deliberately included here, unlike
   * getDetailForCustomer/getDetailForSupplier which each restrict on purpose).
   * financialApprovals is a single query across all three order-scoped
   * four-eyes actions (SUPPLIER_PAYMENT_ADMIN_VERIFICATION,
   * DISPUTE_RESOLVE_MANDATORY_REFUND, EXTERNAL_SUPPLIER_FINAL_APPROVAL) since
   * FinancialApprovalService always keys these by entityType:'order' — there
   * is no need to first gather per-payment/per-dispute sub-entity ids.
   */
  async getDetailForAdmin(orderId: string) {
    const trx = this.uow.getClient();
    const order = await trx.selectFrom('order').selectAll().where('id', '=', orderId).executeTakeFirst();
    if (!order) throw new NotFoundException(`order ${orderId} not found`);

    const [
      customer,
      registeredSupplier,
      externalSupplier,
      offers,
      contract,
      productionUpdates,
      shippingDocuments,
      customsFees,
      disputes,
      escalations,
      renewals,
      timeline,
      financialApprovals,
    ] = await Promise.all([
      trx.selectFrom('customer').selectAll().where('id', '=', order.customer_id).executeTakeFirst(),
      order.registered_supplier_id
        ? trx.selectFrom('registered_supplier').selectAll().where('id', '=', order.registered_supplier_id).executeTakeFirst()
        : Promise.resolve(undefined),
      // external_supplier.order_id is set at creation time (external-suppliers.service.ts),
      // before order.external_supplier_id itself gets populated at approve() time — query
      // by order_id so the vetting card shows up even mid-vetting, not just after approval.
      trx.selectFrom('external_supplier').selectAll().where('order_id', '=', orderId).executeTakeFirst(),
      trx.selectFrom('offer').selectAll().where('order_id', '=', orderId).orderBy('submitted_at', 'asc').execute(),
      trx.selectFrom('contract').selectAll().where('order_id', '=', orderId).executeTakeFirst(),
      trx.selectFrom('production_update').selectAll().where('order_id', '=', orderId).orderBy('posted_at', 'asc').execute(),
      trx.selectFrom('shipping_document').selectAll().where('order_id', '=', orderId).orderBy('uploaded_at', 'asc').execute(),
      trx.selectFrom('customs_fee').selectAll().where('order_id', '=', orderId).execute(),
      trx.selectFrom('dispute').selectAll().where('order_id', '=', orderId).execute(),
      trx.selectFrom('escalation').selectAll().where('order_id', '=', orderId).execute(),
      trx.selectFrom('agreement_renewal').selectAll().where('order_id', '=', orderId).execute(),
      trx.selectFrom('state_transition_log').selectAll().where('order_id', '=', orderId).orderBy('id', 'asc').execute(),
      trx
        .selectFrom('financial_approval')
        .selectAll()
        .where('entity_type', '=', 'order')
        .where('entity_id', '=', orderId)
        .where('action', 'in', ['SUPPLIER_PAYMENT_ADMIN_VERIFICATION', 'DISPUTE_RESOLVE_MANDATORY_REFUND', 'EXTERNAL_SUPPLIER_FINAL_APPROVAL'])
        .orderBy('submitted_at', 'desc')
        .execute(),
    ]);

    const disputeClaims = disputes.length
      ? await trx
          .selectFrom('dispute_claim')
          .selectAll()
          .where(
            'dispute_id',
            'in',
            disputes.map((d) => d.id),
          )
          .execute()
      : [];

    const paymentPlan = contract ? await trx.selectFrom('payment_plan').selectAll().where('contract_id', '=', contract.id).executeTakeFirst() : undefined;
    const installments = paymentPlan
      ? await trx.selectFrom('payment_installment').selectAll().where('payment_plan_id', '=', paymentPlan.id).orderBy('sequence_no', 'asc').execute()
      : [];
    const payments = installments.length
      ? await trx
          .selectFrom('payment')
          .selectAll()
          .where(
            'installment_id',
            'in',
            installments.map((i) => i.id),
          )
          .execute()
      : [];
    const receipts = payments.length
      ? await trx
          .selectFrom('receipt')
          .selectAll()
          .where(
            'payment_id',
            'in',
            payments.map((p) => p.id),
          )
          .execute()
      : [];

    return {
      order,
      customer,
      registeredSupplier,
      externalSupplier,
      offers,
      contract,
      paymentPlan,
      installments,
      payments,
      receipts,
      productionUpdates,
      shippingDocuments,
      customsFees,
      disputes,
      disputeClaims,
      escalations,
      renewals,
      timeline,
      financialApprovals,
    };
  }

  async submit(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'submit', actor, expectedStateVersion });
  }

  /**
   * v1 simplification: the deposit is a fixed, non-refundable, admin-verified
   * bank transfer, but is not yet modeled as a full Payment/Receipt row the
   * way trust-fund installments are (PaymentPlan/PaymentInstallment only
   * exist from CONTRACT_PAYMENT_PLAN_CREATED onward — there is currently no
   * home for a payment that happens before any PaymentPlan exists). A v2
   * follow-up should introduce a plan-less "standalone payment" record so
   * the deposit gets the same receipt-fingerprint/audit treatment as every
   * other payment instead of being a bare state transition.
   */
  async confirmDeposit(orderId: string, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'deposit_paid', actor: SYSTEM, expectedStateVersion });
  }

  async requestEdit(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'request_edit', actor, expectedStateVersion });
  }

  async resubmit(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'resubmit', actor, expectedStateVersion });
  }

  async reject(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    const rejected = await this.engine.transition({ orderId, event: 'reject', actor, expectedStateVersion });
    await this.engine.transition({ orderId, event: 'auto_close', actor: SYSTEM, expectedStateVersion: rejected.stateVersion });
    return rejected;
  }

  /**
   * Approves the order, records the admin's supplier-sourcing decision, and
   * chains the two SYSTEM-only transitions (REVIEW_APPROVED -> SUPPLIER_CHOICE
   * -> route) in the same request/transaction, since neither is a distinct
   * business decision a human needs to act on separately.
   */
  async approveAndRoute(orderId: string, actor: ActorRef, dto: ApproveOrderDto) {
    const trx = this.uow.getClient();
    const order = await trx.selectFrom('order').selectAll().where('id', '=', orderId).executeTakeFirstOrThrow();
    const serviceType = await trx
      .selectFrom('service_type')
      .selectAll()
      .where('id', '=', order.service_type_id)
      .executeTakeFirstOrThrow();

    let supplierType: 'REGISTERED' | 'EXTERNAL' | 'NONE' = 'NONE';
    if (serviceType.includes_sourcing) {
      if (!dto.supplierType) {
        throw new BadRequestException('supplierType is required because this service type includes sourcing');
      }
      supplierType = dto.supplierType;
      if (supplierType === 'EXTERNAL' && !dto.externalSupplierId) {
        throw new BadRequestException('externalSupplierId is required when supplierType is EXTERNAL');
      }
    } else if (dto.supplierType) {
      throw new BadRequestException('this service type does not include sourcing — supplierType must be omitted');
    }

    await trx
      .updateTable('order')
      .set({
        supplier_type: supplierType,
        external_supplier_id: supplierType === 'EXTERNAL' ? (dto.externalSupplierId ?? null) : null,
      })
      .where('id', '=', orderId)
      .execute();

    const approved = await this.engine.transition({ orderId, event: 'approve', actor, expectedStateVersion: dto.expectedStateVersion });
    const continued = await this.engine.transition({
      orderId,
      event: 'continue',
      actor: SYSTEM,
      expectedStateVersion: approved.stateVersion,
    });
    const routed = await this.engine.transition({
      orderId,
      event: 'route',
      actor: SYSTEM,
      expectedStateVersion: continued.stateVersion,
    });

    // REG_PUBLISHED has no independent business decision attached to it in
    // v1 (the "open broadcast, no category gate" decision means publishing
    // is automatic the instant routing lands here) — chain it in the same
    // request rather than requiring a separate admin click.
    if (routed.toState === 'REG_PUBLISHED') {
      return this.engine.transition({
        orderId,
        event: 'auto_publish',
        actor: SYSTEM,
        expectedStateVersion: routed.stateVersion,
        ctxOverrides: { biddingDeadlineMs: this.config.get('biddingDeadlineMs', { infer: true }) },
      });
    }
    return routed;
  }
}
