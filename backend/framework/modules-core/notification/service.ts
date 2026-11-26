import { TraikuService } from '../../modules';
import type { ProjectConfig } from '../../config';
import { isSmsBlocked, TraikuError } from '../../utils';
import Notification from './models/notification';
import type { NotificationProvider } from './providers';

export type CreateNotificationInput = { to: string; channel: 'sms'; template: string; text: string; data?: Record<string, unknown> };

export default class NotificationModuleService extends TraikuService({ Notification }) {
  private providers: NotificationProvider[] = [];

  registerProvider(provider: NotificationProvider) {
    this.providers.push(provider);
  }

  /** Records each message, sends it, and keeps the result; a failure is recorded, not thrown. */
  async send(inputs: CreateNotificationInput | CreateNotificationInput[]) {
    const out = [];
    for (const input of Array.isArray(inputs) ? inputs : [inputs]) {
      const provider = this.providers.find((p) => p.channels.includes(input.channel));
      if (!provider) throw new TraikuError(TraikuError.Types.UNEXPECTED_STATE, `Aucun fournisseur pour le canal ${input.channel}`);
      const row = await this.createNotifications({ to: input.to, channel: input.channel, template: input.template, data: input.data ?? null, provider_id: provider.id });
      // Last guard against SMS pumping, whatever called this.
      const { blockedPrefixes } = (this.options.projectConfig as ProjectConfig).sms;
      if (input.channel === 'sms' && isSmsBlocked(input.to, blockedPrefixes)) {
        this.logger.warn(`SMS refusé vers ${input.to} : numéro spécial ou surtaxé`);
        out.push(await this.updateNotifications({ id: row.id, status: 'failure', error: 'Numéro spécial ou surtaxé' }));
        continue;
      }
      try {
        const res = await provider.send(input);
        out.push(await this.updateNotifications({ id: row.id, status: 'success', external_id: res.id ?? null }));
      } catch (e) {
        this.logger.error(`notification ${input.template} vers ${input.to} : ${(e as Error).message}`);
        out.push(await this.updateNotifications({ id: row.id, status: 'failure', error: (e as Error).message }));
      }
    }
    return out;
  }
}
