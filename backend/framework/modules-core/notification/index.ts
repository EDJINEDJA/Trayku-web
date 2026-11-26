import { Module } from '../../modules';
import { Modules } from '../../utils';
import { LocalNotificationProvider, TwilioSmsProvider } from './providers';
import NotificationModuleService from './service';

type Options = { providers?: { resolve: 'local' | 'twilio'; options?: Record<string, string> }[] };

export default Module(Modules.NOTIFICATION, {
  service: NotificationModuleService,
  loaders: [
    ({ service, options, logger }) => {
      const s = service as NotificationModuleService;
      const providers = (options as Options).providers ?? [{ resolve: 'local' }];
      for (const p of providers) {
        if (p.resolve === 'twilio') {
          const { accountSid, authToken, from } = p.options ?? {};
          if (!accountSid || !authToken || !from) throw new Error('Twilio : accountSid, authToken et from sont requis');
          s.registerProvider(new TwilioSmsProvider({ accountSid, authToken, from }));
        } else s.registerProvider(new LocalNotificationProvider(logger));
      }
    },
  ],
});
export { NotificationModuleService };
export * from './providers';
