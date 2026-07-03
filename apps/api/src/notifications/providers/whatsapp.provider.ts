import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { ProviderResult } from './provider-result';

/**
 * Real Meta WhatsApp Cloud API integration via the platform's own outbound
 * business number — not a stub, and not the same thing as the platform-only
 * contact rule (that rule bans direct customer<->supplier WhatsApp exchange
 * to prevent commission bypass; this is a one-way platform->single-party
 * notification, a different concern entirely). Uses the runtime's built-in
 * fetch rather than adding an SDK dependency. With no WHATSAPP_* env vars set,
 * short-circuits to NO_CONFIG without attempting a request.
 */
@Injectable()
export class WhatsappProvider {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async send(to: string, message: string): Promise<ProviderResult> {
    const whatsapp = this.config.get('whatsapp', { infer: true });
    if (!whatsapp.accessToken || !whatsapp.phoneNumberId) {
      return { sent: false, reason: 'NO_CONFIG' };
    }

    try {
      const response = await fetch(`${whatsapp.apiBaseUrl}/${whatsapp.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message },
        }),
      });

      if (!response.ok) {
        return { sent: false, reason: 'ERROR', error: `WhatsApp API responded ${response.status}: ${await response.text()}` };
      }
      return { sent: true };
    } catch (err) {
      return { sent: false, reason: 'ERROR', error: (err as Error).message };
    }
  }
}
