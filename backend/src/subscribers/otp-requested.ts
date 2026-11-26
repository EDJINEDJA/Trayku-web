import { Modules, type NotificationModuleService } from '@traiku/framework';
import type { SubscriberArgs, SubscriberConfig } from '@traiku/framework/events';

/** The sign-in code by SMS. */
export default async function otpRequested({ event, container }: SubscriberArgs<{ phone: string; code: string }>) {
  await container.resolve<NotificationModuleService>(Modules.NOTIFICATION).send({
    to: event.data.phone,
    channel: 'sms',
    template: 'auth-otp',
    text: `Traiku : votre code est ${event.data.code}. Il expire dans 10 minutes. Ne le donnez à personne.`,
  });
}

export const config: SubscriberConfig = { event: 'auth.otp_requested' };
