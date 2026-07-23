import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely, sql } from 'kysely';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ActorRef } from '@apex/domain';
import { KYSELY } from '../database/database.module';
import { DB } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { AppConfig } from '../config/configuration';

export interface StoredUpload {
  filePath: string;
  mimeType: string;
  originalFilename: string;
}

/**
 * Local-disk storage (no cloud credentials available in this environment —
 * see the SMTP/WhatsApp precedent in notifications). uploaded_file's RLS
 * INSERT policy is permissive by design (see 1700000000028_real-auth.sql),
 * so — unlike dispute/notification_log, which are only ever written after
 * computeTransition() already authorized the specific event — this service
 * must check order visibility itself before writing, reusing the exact same
 * order_visible_to_actor() function RLS already relies on for reads.
 */
@Injectable()
export class UploadsService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async save(actor: ActorRef, orderId: string, file: Express.Multer.File): Promise<{ id: string; url: string }> {
    const trx = this.uow.getClient();
    const visibility = await sql<{ visible: boolean }>`select order_visible_to_actor(${orderId}::uuid) as visible`.execute(trx);
    if (!visibility.rows[0]?.visible) {
      throw new NotFoundException(`order ${orderId} not found`);
    }

    const storedFilename = `${randomUUID()}-${file.originalname}`;
    const orderDir = path.join(this.config.get('uploadsDir', { infer: true }), orderId);
    await fs.mkdir(orderDir, { recursive: true });
    await fs.writeFile(path.join(orderDir, storedFilename), file.buffer);

    const created = await trx
      .insertInto('uploaded_file')
      .values({
        order_id: orderId,
        uploaded_by_type: actor.role.startsWith('ADMIN') ? 'ADMIN' : actor.role,
        uploaded_by_id: actor.id,
        stored_filename: storedFilename,
        original_filename: file.originalname,
        mime_type: file.mimetype,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    return { id: created.id, url: `/uploads/${created.id}` };
  }

  /**
   * Returns null both when the row genuinely doesn't exist and when RLS
   * silently filtered it out for this actor — same 404 either way, so a
   * caller never learns whether a given file id exists at all.
   */
  async resolve(fileId: string): Promise<StoredUpload | null> {
    const trx = this.uow.getClient();
    const row = await trx.selectFrom('uploaded_file').selectAll().where('id', '=', fileId).executeTakeFirst();
    if (!row) return null;
    return {
      filePath: path.join(this.config.get('uploadsDir', { infer: true }), row.order_id, row.stored_filename),
      mimeType: row.mime_type,
      originalFilename: row.original_filename,
    };
  }
}
