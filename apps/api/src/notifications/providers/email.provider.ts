import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { AppConfig } from '../../config/configuration';
import { ProviderResult } from './provider-result';

/**
 * A real, functioning SMTP integration — not a stub. With no SMTP_* env vars
 * set (the case in this environment today), it short-circuits to NO_CONFIG
 * without attempting a connection; supplying real credentials in .env
 * activates real sending with no code change.
 */
@Injectable()
export class EmailProvider {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async send(to: string, message: string): Promise<ProviderResult> {
    const smtp = this.config.get('smtp', { infer: true });
    if (!smtp.host || !smtp.user || !smtp.password) {
      return { sent: false, reason: 'NO_CONFIG' };
    }

    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.password },
    });

    try {
      await transport.sendMail({ from: smtp.fromAddress, to, subject: 'Apex Sourcing', text: message });
      return { sent: true };
    } catch (err) {
      return { sent: false, reason: 'ERROR', error: (err as Error).message };
    }
  }
}
