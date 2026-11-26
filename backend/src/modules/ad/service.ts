import { TraikuService } from '@traiku/framework';
import Ad from './models/ad';
import AdReport from './models/ad-report';

export type AdCounter = 'views' | 'clicks' | 'reports';

export default class AdModuleService extends TraikuService({ Ad, AdReport }) {
  /** One more view, click or report, counted in the database (two phones at once both count). */
  async bumpAd(id: string, counter: AdCounter, by = 1) {
    await this.db('ad').where({ id }).whereNull('deleted_at').increment(counter, by);
  }

  /** The ads of a place running at `now`: active, started, not ended. */
  async listRunningAds(placement: string, now = new Date()) {
    return this.db('ad')
      .where({ placement, active: true })
      .whereNull('deleted_at')
      .andWhere((q) => q.whereNull('starts_at').orWhere('starts_at', '<=', now))
      .andWhere((q) => q.whereNull('ends_at').orWhere('ends_at', '>', now))
      .orderBy('created_at', 'desc') as Promise<{ id: string; placement: string; title: string; image_file_id: string; url: string }[]>;
  }
}
