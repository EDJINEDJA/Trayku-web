import os from 'node:os';
import path from 'node:path';
import multer from 'multer';
import { authenticate, defineMiddlewares, rateLimit, validateAndTransformBody, validateAndTransformQuery } from '@traiku/framework/http';
import * as v from './utils/validators';

/**
 * As Medusa's src/api/middlewares.ts. Already applied by the framework: the publishable key on
 * /app/*, the team sign-in on /admin/*. Here: who must be signed in, the validation, the limits.
 */

const member = authenticate('member', 'bearer');
// On disk in a temporary folder (100 MB per request would not hold in memory); the route removes them.
const upload = multer({ dest: path.join(os.tmpdir(), 'traiku-uploads'), limits: { fileSize: 10 * 1024 * 1024, files: 10, fields: 5, parts: 15 } });
const perMember = (req: { auth_context?: { actor_id: string } }) => `${req.auth_context?.actor_id}`;
const perPhone = (req: { body?: { phone?: unknown } }) => String(req.body?.phone ?? '').replace(/\D/g, '');

export default defineMiddlewares({
  routes: [
    // Sign-in
    { matcher: '/auth/member/phone-otp/request', method: 'POST', middlewares: [rateLimit({ windowMs: 10 * 60_000, max: 10 }), validateAndTransformBody(v.RequestOtp)] },
    {
      matcher: '/auth/member/phone-otp',
      method: 'POST',
      middlewares: [rateLimit({ windowMs: 10 * 60_000, max: 20 }), rateLimit({ windowMs: 10 * 60_000, max: 6, key: perPhone }), validateAndTransformBody(v.VerifyOtp)],
    },
    { matcher: '/auth/user/emailpass', method: 'POST', middlewares: [rateLimit({ windowMs: 15 * 60_000, max: 10 }), validateAndTransformBody(v.EmailPass)] },
    { matcher: '/auth/token/refresh', method: 'POST', middlewares: [authenticate(['member', 'user'], 'bearer', { allowUnregistered: true })] },
    { matcher: '/auth/token', method: 'DELETE', middlewares: [authenticate(['member', 'user'], 'bearer', { allowUnregistered: true })] },
    { matcher: '/auth/session', method: 'POST', middlewares: [authenticate('user', 'bearer')] },

    // App: account
    // The member's region when signed in; anyone otherwise.
    { matcher: '/app/reference', method: 'GET', middlewares: [authenticate('member', 'bearer', { allowUnauthenticated: true })] },
    { matcher: '/app/members', method: 'POST', middlewares: [authenticate('member', 'bearer', { allowUnregistered: true }), validateAndTransformBody(v.CreateMember)] },
    { matcher: '/app/me', middlewares: [member] },
    { matcher: '/app/me', method: 'POST', middlewares: [validateAndTransformBody(v.UpdateMe)] },
    { matcher: '/app/me/*', method: 'GET', middlewares: [member, validateAndTransformQuery(v.ListQuery)] },
    { matcher: '/app/me/identity', method: 'POST', middlewares: [member, rateLimit({ windowMs: 3600_000, max: 10, key: perMember }), validateAndTransformBody(v.SubmitIdentity)] },
    { matcher: '/app/me/certificates/:trade', method: 'POST', middlewares: [member, rateLimit({ windowMs: 3600_000, max: 10, key: perMember }), validateAndTransformBody(v.CertificateAnswers)] },
    { matcher: '/app/me/support', method: 'POST', middlewares: [member, rateLimit({ windowMs: 3600_000, max: 10, key: perMember }), validateAndTransformBody(v.CreateSupportRequest)] },
    { matcher: '/app/me/delete-request', method: 'POST', middlewares: [member] },
    { matcher: '/app/me/credentials', method: 'POST', middlewares: [member, rateLimit({ windowMs: 3600_000, max: 10, key: perMember }), validateAndTransformBody(v.SubmitCredential)] },
    // App: payouts (the account where earnings go, a withdrawal)
    { matcher: '/app/me/payout-account', method: 'POST', middlewares: [member, rateLimit({ windowMs: 3600_000, max: 20, key: perMember }), validateAndTransformBody(v.SetupPayoutAccount)] },
    { matcher: '/app/me/payout-account/bank', method: 'POST', middlewares: [member, rateLimit({ windowMs: 3600_000, max: 10, key: perMember }), validateAndTransformBody(v.SavePayoutBank)] },
    { matcher: '/app/me/payout-account/sync', method: 'POST', middlewares: [member, rateLimit({ windowMs: 60_000, max: 20, key: perMember })] },
    { matcher: '/app/me/payouts', method: 'POST', middlewares: [member, rateLimit({ windowMs: 3600_000, max: 10, key: perMember, message: 'Trop de demandes de retrait : réessayez dans une heure.' })] },

    // App: missions (browsing works signed out; acting needs an account)
    { matcher: '/app/missions', method: 'GET', middlewares: [rateLimit({ windowMs: 60_000, max: 120 }), authenticate('member', 'bearer', { allowUnauthenticated: true }), validateAndTransformQuery(v.ListMissions)] },
    { matcher: '/app/missions', method: 'POST', middlewares: [member, rateLimit({ windowMs: 3600_000, max: 20, key: perMember, message: 'Vous avez publié beaucoup de missions : réessayez dans une heure.' }), validateAndTransformBody(v.CreateMission)] },
    { matcher: '/app/missions/:id', method: 'GET', middlewares: [authenticate('member', 'bearer', { allowUnauthenticated: true })] },
    { matcher: '/app/missions/:id/*', middlewares: [member] },
    { matcher: '/app/missions/:id/accept', method: 'POST', middlewares: [rateLimit({ windowMs: 60_000, max: 10 }), validateAndTransformBody(v.AcceptMission)] },
    { matcher: '/app/missions/:id/proposals', method: 'POST', middlewares: [rateLimit({ windowMs: 60_000, max: 10, key: perMember }), validateAndTransformBody(v.ProposeTime)] },
    { matcher: '/app/missions/:id/proposals/choose', method: 'POST', middlewares: [validateAndTransformBody(v.ChooseProposal)] },
    { matcher: '/app/missions/:id/payment', method: 'POST', middlewares: [rateLimit({ windowMs: 60_000, max: 10, key: perMember }), validateAndTransformBody(v.PayMission)] },
    { matcher: '/app/missions/:id/payment/confirm', method: 'POST', middlewares: [rateLimit({ windowMs: 60_000, max: 30, key: perMember })] },
    // Providers: their webhooks and the payer back from their page (no key: the provider and the browser call them).
    { matcher: '/hooks/payment/*', middlewares: [rateLimit({ windowMs: 60_000, max: 120 })] },
    { matcher: '/hooks/payout/*', middlewares: [rateLimit({ windowMs: 60_000, max: 120 })] },

    // App: the run, step by step
    { matcher: '/app/runs/*', middlewares: [member] },
    { matcher: '/app/runs/:id/*', method: 'POST', middlewares: [rateLimit({ windowMs: 60_000, max: 30, key: perMember })] },
    { matcher: '/app/runs/:id/leg', method: 'POST', middlewares: [validateAndTransformBody(v.StartLeg)] },
    { matcher: '/app/runs/:id/face', method: 'POST', middlewares: [validateAndTransformBody(v.FaceCheck)] },
    { matcher: '/app/runs/:id/seller-code', method: 'POST', middlewares: [validateAndTransformBody(v.CodeBody)] },
    { matcher: '/app/runs/:id/report', method: 'POST', middlewares: [validateAndTransformBody(v.SendReport)] },
    { matcher: '/app/runs/:id/decision', method: 'POST', middlewares: [validateAndTransformBody(v.Decide)] },
    { matcher: '/app/runs/:id/pickup', method: 'POST', middlewares: [validateAndTransformBody(v.ConfirmPickup)] },
    { matcher: '/app/runs/:id/dropoff', method: 'POST', middlewares: [validateAndTransformBody(v.ConfirmDropoff)] },
    { matcher: '/app/runs/:id/photos', method: 'POST', middlewares: [validateAndTransformBody(v.OnsitePhotos)] },
    { matcher: '/app/runs/:id/complete', method: 'POST', middlewares: [validateAndTransformBody(v.CompleteOnsite)] },
    { matcher: '/app/runs/:id/release', method: 'POST', middlewares: [validateAndTransformBody(v.Release)] },
    { matcher: '/app/runs/:id/no-show', method: 'POST', middlewares: [validateAndTransformBody(v.Release)] },
    { matcher: '/app/runs/:id/pickup-code', method: 'POST', middlewares: [validateAndTransformBody(v.PickupCode)] },
    { matcher: '/app/runs/:id/tip', method: 'POST', middlewares: [validateAndTransformBody(v.SetTip)] },
    { matcher: '/app/runs/:id/extra-time', method: 'POST', middlewares: [validateAndTransformBody(v.RequestExtraTime)] },
    { matcher: '/app/runs/:id/extra-time/answer', method: 'POST', middlewares: [validateAndTransformBody(v.AnswerExtraTime)] },

    // App: the rest
    { matcher: '/app/trips', method: 'POST', middlewares: [member, validateAndTransformBody(v.CreateTrip)] },
    { matcher: '/app/trips/*', middlewares: [member] },
    { matcher: '/app/trips/:id/missions', method: 'GET', middlewares: [rateLimit({ windowMs: 60_000, max: 30, key: perMember }), validateAndTransformQuery(v.ListQuery)] },
    { matcher: '/app/members/:id', method: 'GET', middlewares: [validateAndTransformQuery(v.ListQuery)] },
    { matcher: '/app/reviews', method: 'POST', middlewares: [member, validateAndTransformBody(v.CreateReview)] },
    { matcher: '/app/disputes', method: 'POST', middlewares: [member, validateAndTransformBody(v.OpenDispute)] },
    { matcher: '/app/conversations', middlewares: [member] },
    { matcher: '/app/conversations/*', middlewares: [member] },
    { matcher: '/app/conversations/:id/messages', method: 'GET', middlewares: [validateAndTransformQuery(v.ListQuery)] },
    { matcher: '/app/conversations/:id/messages', method: 'POST', middlewares: [rateLimit({ windowMs: 60_000, max: 30, key: perMember }), validateAndTransformBody(v.SendMessage)] },
    { matcher: '/app/uploads', method: 'POST', middlewares: [member, rateLimit({ windowMs: 60_000, max: 60, key: perMember }), upload.array('files', 10)] },

    // App: ads (signed in or not); views and clicks limited per address, reports too
    { matcher: '/app/ads/:id/events', method: 'POST', middlewares: [rateLimit({ windowMs: 60_000, max: 60 }), validateAndTransformBody(v.TrackAd)] },
    { matcher: '/app/ads/:id/report', method: 'POST', middlewares: [authenticate('member', 'bearer', { allowUnauthenticated: true }), rateLimit({ windowMs: 3600_000, max: 10 })] },

    // Admin
    { matcher: '/admin/support/:id/answer', method: 'POST', middlewares: [validateAndTransformBody(v.AnswerSupportRequest)] },
    { matcher: '/admin/ads', method: 'POST', middlewares: [validateAndTransformBody(v.CreateAd)] },
    { matcher: '/admin/ads/:id', method: 'POST', middlewares: [validateAndTransformBody(v.UpdateAd)] },
    { matcher: '/admin/uploads', method: 'POST', middlewares: [upload.array('files', 1)] },
    { matcher: '/admin/api-keys', method: 'POST', middlewares: [validateAndTransformBody(v.CreateApiKey)] },
    { matcher: '/admin/pricing', method: 'POST', middlewares: [validateAndTransformBody(v.SavePricing)] },
    { matcher: '/admin/regions', method: 'POST', middlewares: [validateAndTransformBody(v.CreateRegion)] },
    { matcher: '/admin/regions/:id', method: 'POST', middlewares: [validateAndTransformBody(v.UpdateRegion)] },
    { matcher: '/admin/user-actions', method: 'GET', middlewares: [validateAndTransformQuery(v.ListQuery)] },
    { matcher: '/admin/missions', method: 'GET', middlewares: [validateAndTransformQuery(v.AdminListQuery)] },
    { matcher: '/admin/missions/:id/review', method: 'POST', middlewares: [validateAndTransformBody(v.ReviewMission)] },
    { matcher: '/admin/members', method: 'GET', middlewares: [validateAndTransformQuery(v.AdminListQuery)] },
    { matcher: '/admin/members/:id', method: 'POST', middlewares: [validateAndTransformBody(v.UpdateMemberAdmin)] },
    { matcher: '/admin/disputes', method: 'GET', middlewares: [validateAndTransformQuery(v.AdminListQuery)] },
    { matcher: '/admin/disputes/:id/resolve', method: 'POST', middlewares: [validateAndTransformBody(v.ResolveDispute)] },
    { matcher: '/admin/identity-checks', method: 'GET', middlewares: [validateAndTransformQuery(v.AdminListQuery)] },
    { matcher: '/admin/identity-checks/:id/review', method: 'POST', middlewares: [validateAndTransformBody(v.Review)] },
    { matcher: '/admin/credentials', method: 'GET', middlewares: [validateAndTransformQuery(v.AdminListQuery)] },
    { matcher: '/admin/credentials/:id/review', method: 'POST', middlewares: [validateAndTransformBody(v.Review)] },
    { matcher: '/admin/payouts', method: 'GET', middlewares: [validateAndTransformQuery(v.AdminPayoutsQuery)] },
    { matcher: '/admin/payouts/balances', method: 'GET', middlewares: [validateAndTransformQuery(v.ListQuery)] },
    { matcher: '/admin/payouts/export', method: 'GET', middlewares: [validateAndTransformQuery(v.PayoutsExportQuery)] },
    { matcher: '/admin/members/:id/payout-hold', method: 'POST', middlewares: [validateAndTransformBody(v.HoldPayouts)] },
  ],
});
