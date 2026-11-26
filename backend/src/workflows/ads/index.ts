import { emitEventStep } from '@traiku/framework/core-flows';
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse, type StepExecutionContext } from '@traiku/framework/workflows';
import { TraikuError } from '@traiku/framework';
import { AD_MODULE, type AdCounter, type AdModuleService } from '../../modules/ad';

/**
 * Ads: created, changed, removed from the admin; seen, clicked and reported from the app. Each step
 * undoes what it did if a later one fails (the counters aren't undone: a view was a view).
 */

type Ctx = Pick<StepExecutionContext, 'container'>;
const svc = (ctx: Ctx) => ctx.container.resolve<AdModuleService>(AD_MODULE);

export type AdInput = {
  placement?: 'messages';
  sponsor: string;
  title: string;
  image_file_id: string;
  url: string;
  starts_at?: Date | null;
  ends_at?: Date | null;
  active?: boolean;
};

/** The end after the start, when both are set. */
function assertPeriod(a: Pick<AdInput, 'starts_at' | 'ends_at'>) {
  if (a.starts_at && a.ends_at && a.ends_at <= a.starts_at) throw new TraikuError(TraikuError.Types.INVALID_DATA, 'La fin doit venir après le début.');
}

// ── Create ───────────────────────────────────────────────────────────────────

export const createAdStep = createStep(
  'create-ad',
  async (input: AdInput, ctx) => {
    assertPeriod(input);
    const ad = await svc(ctx).createAds({ ...input, sponsor: input.sponsor.trim(), title: input.title.trim(), url: input.url.trim() });
    return new StepResponse(ad, ad.id);
  },
  async (id, ctx) => {
    if (id) await svc(ctx).deleteAds(id);
  }
);

export const createAdWorkflow = createWorkflow('create-ad', (input: AdInput) => {
  const ad = createAdStep(input);
  emitEventStep({ eventName: 'ad.created', data: transform({ ad }, ({ ad }) => ({ id: ad.id })) });
  return new WorkflowResponse(ad);
});

// ── Update ───────────────────────────────────────────────────────────────────

export const updateAdStep = createStep(
  'update-ad',
  async (input: { id: string; update: Partial<AdInput> }, ctx) => {
    const before = await svc(ctx).retrieveAd(input.id);
    assertPeriod({ starts_at: input.update.starts_at === undefined ? before.starts_at : input.update.starts_at, ends_at: input.update.ends_at === undefined ? before.ends_at : input.update.ends_at });
    const ad = await svc(ctx).updateAds({ id: before.id, ...input.update });
    const { views: _v, clicks: _c, reports: _r, created_at: _ca, updated_at: _ua, deleted_at: _da, ...kept } = before;
    return new StepResponse(ad, kept);
  },
  async (kept, ctx) => {
    if (kept) await svc(ctx).updateAds(kept);
  }
);

export const updateAdWorkflow = createWorkflow('update-ad', (input: { id: string; update: Partial<AdInput> }) => {
  const ad = updateAdStep(input);
  emitEventStep({ eventName: 'ad.updated', data: transform({ ad }, ({ ad }) => ({ id: ad.id })) });
  return new WorkflowResponse(ad);
});

// ── Delete ───────────────────────────────────────────────────────────────────

export const deleteAdStep = createStep(
  'delete-ad',
  async (input: { id: string }, ctx) => {
    await svc(ctx).retrieveAd(input.id);
    await svc(ctx).softDeleteAds([input.id]);
    return new StepResponse(input.id, input.id);
  },
  async (id, ctx) => {
    if (id) await svc(ctx).restoreAds([id]);
  }
);

export const deleteAdWorkflow = createWorkflow('delete-ad', (input: { id: string }) => {
  const id = deleteAdStep(input);
  emitEventStep({ eventName: 'ad.deleted', data: transform({ id }, ({ id }) => ({ id })) });
  return new WorkflowResponse(id);
});

// ── From the app ─────────────────────────────────────────────────────────────

/** The ad must exist and run; a view or click on one taken down since is ignored. */
const runningAdStep = createStep('running-ad', async (input: { id: string }, ctx) => {
  const [ad] = await svc(ctx).listAds({ id: input.id }, { take: 1 });
  if (!ad) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Publicité introuvable.');
  return new StepResponse(ad.id);
});

const bumpAdStep = createStep('bump-ad', async (input: { id: string; counter: AdCounter }, ctx) => {
  await svc(ctx).bumpAd(input.id, input.counter);
  return new StepResponse(undefined);
});

/** « Vue » once per display, « clic » on a tap: counted for the sponsor. */
export const trackAdWorkflow = createWorkflow('track-ad', (input: { id: string; type: 'view' | 'click' }) => {
  const id = runningAdStep({ id: input.id });
  bumpAdStep(transform({ id, input }, ({ id, input }) => ({ id, counter: input.type === 'view' ? ('views' as const) : ('clicks' as const) })));
  return new WorkflowResponse(id);
});

const createAdReportStep = createStep(
  'create-ad-report',
  async (input: { ad_id: string; member_id: string | null }, ctx) => {
    const report = await svc(ctx).createAdReports(input);
    return new StepResponse(report, report.id);
  },
  async (id, ctx) => {
    if (id) await svc(ctx).deleteAdReports(id);
  }
);

/** « Signaler cette publicité »: recorded, counted, and told to the team (ad.reported). */
export const reportAdWorkflow = createWorkflow('report-ad', (input: { id: string; member_id: string | null }) => {
  const id = runningAdStep({ id: input.id });
  const report = createAdReportStep(transform({ id, input }, ({ id, input }) => ({ ad_id: id, member_id: input.member_id })));
  // Last: a counter is not undone.
  bumpAdStep(transform({ id }, ({ id }) => ({ id, counter: 'reports' as const })));
  emitEventStep({ eventName: 'ad.reported', data: transform({ id, report }, ({ id, report }) => ({ id, report_id: report.id })) });
  return new WorkflowResponse(report);
});
