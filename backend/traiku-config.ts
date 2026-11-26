import { defineConfig, loadEnv } from '@traiku/framework';

loadEnv(process.env.NODE_ENV || 'development', process.cwd());

/** "a, b" → ["a", "b"]; empty or absent → the default. */
const list = (v?: string) => (v ? v.split(',').map((p) => p.trim()).filter(Boolean) : undefined);

// Payments, as Medusa's: test (the providers' sandboxes and the test payment) or live (real money).
const live = process.env.PAYMENT_MODE === 'live';
const env = (name: string) => process.env[`${name.replace('*', live ? 'LIVE' : 'TEST')}`] || undefined;
const stripeKey = env('STRIPE_*_API_KEY');
const paypalId = env('PAYPAL_*_CLIENT_ID');

const twilio = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM;

export default defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL!,
    databaseMigrationUrl: process.env.DATABASE_MIGRATION_URL,
    databaseLogging: process.env.DATABASE_LOGGING === 'true',
    http: {
      port: Number(process.env.PORT) || 9000,
      trustProxy: Number(process.env.TRUST_PROXY) || 0,
      backendUrl: process.env.BACKEND_URL,
      jwtSecret: process.env.JWT_SECRET,
      fileSecret: process.env.FILE_SECRET,
      appCors: process.env.APP_CORS,
      adminCors: process.env.ADMIN_CORS,
      authCors: process.env.AUTH_CORS,
    },
    sms: {
      blockedPrefixes: list(process.env.SMS_BLOCKED_PREFIXES),
      homePrefixes: list(process.env.SMS_HOME_PREFIXES),
      otpMaxPerHour: Number(process.env.OTP_MAX_PER_HOUR) || undefined,
      otpMaxPerZonePerHour: Number(process.env.OTP_MAX_PER_ZONE_PER_HOUR) || undefined,
    },
  },
  modules: [
    {
      key: 'notification',
      options: {
        providers: [
          twilio
            ? { resolve: 'twilio', options: { accountSid: process.env.TWILIO_ACCOUNT_SID, authToken: process.env.TWILIO_AUTH_TOKEN, from: process.env.TWILIO_FROM } }
            : { resolve: 'local' },
        ],
      },
    },
    { key: 'file', options: { upload_dir: 'uploads' } },
    {
      key: 'payment',
      options: {
        mode: live ? 'live' : 'test',
        providers: [
          // Test only: accepted at once, nothing charged.
          ...(live ? [] : [{ resolve: 'system' as const }]),
          ...(stripeKey ? [{ resolve: 'stripe' as const, options: { apiKey: stripeKey, webhookSecret: env('STRIPE_*_WEBHOOK_SECRET') } }] : []),
          ...(paypalId ? [{ resolve: 'paypal' as const, options: { clientId: paypalId, clientSecret: env('PAYPAL_*_CLIENT_SECRET') } }] : []),
        ],
      },
    },
    { resolve: './src/modules/member' },
    { resolve: './src/modules/mission' },
    { resolve: './src/modules/trip' },
    { resolve: './src/modules/review' },
    { resolve: './src/modules/conversation' },
    { resolve: './src/modules/currency' },
    { resolve: './src/modules/region' },
    { resolve: './src/modules/brand' },
    { resolve: './src/modules/ad' },
    { resolve: './src/modules/pricing' },
    {
      // The Traikeurs' earnings, sent to their Stripe Connect account (the test provider without a Stripe key).
      resolve: './src/modules/payout',
      options: {
        mode: live ? 'live' : 'test',
        provider: stripeKey ? { resolve: 'stripe' as const, options: { apiKey: stripeKey, webhookSecret: env('STRIPE_*_CONNECT_WEBHOOK_SECRET') } } : { resolve: 'system' as const },
      },
    },
  ],
});
