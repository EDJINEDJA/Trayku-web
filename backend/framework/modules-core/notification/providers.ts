import type { Logger } from '../../logger';

export type SendInput = { to: string; channel: string; template: string; text: string; data?: Record<string, unknown> };

/** As Medusa's notification providers: one per way of sending, chosen by channel. */
export interface NotificationProvider {
  id: string;
  channels: string[];
  send(input: SendInput): Promise<{ id?: string }>;
}

/** Development: writes the message in the server log, codes included. */
export class LocalNotificationProvider implements NotificationProvider {
  id = 'local';
  constructor(
    private readonly logger: Logger,
    readonly channels: string[] = ['sms']
  ) {}
  async send(input: SendInput) {
    this.logger.info(`[${input.channel} → ${input.to}] ${input.text}`);
    return {};
  }
}

/** SMS through Twilio's REST API. */
export class TwilioSmsProvider implements NotificationProvider {
  id = 'twilio';
  channels = ['sms'];
  constructor(private readonly options: { accountSid: string; authToken: string; from: string }) {}

  async send(input: SendInput) {
    const { accountSid, authToken, from } = this.options;
    const body = new URLSearchParams({ To: input.to, Body: input.text, ...(from.startsWith('MG') ? { MessagingServiceSid: from } : { From: from }) });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok) throw new Error(`Twilio ${res.status} : ${json.message ?? 'erreur'}`);
    return { id: json.sid };
  }
}
