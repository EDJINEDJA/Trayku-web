import { Modules, type FileModuleService } from '@traiku/framework';
import { AD_MODULE, type AdModuleService } from '../modules/ad';

type Scope = { resolve: <T>(key: string) => T };

/**
 * The ads as the app gets them (in /app/reference): only what it shows, the picture's link valid a
 * day. The sponsor and the counters stay on the server.
 */
export async function runningAds(scope: Scope) {
  const ads = await scope.resolve<AdModuleService>(AD_MODULE).listRunningAds('messages');
  if (!ads.length) return [];
  const urls = await scope.resolve<FileModuleService>(Modules.FILE).urls(
    ads.map((a) => a.image_file_id),
    24 * 3600
  );
  return ads.filter((a) => urls[a.image_file_id]).map((a) => ({ id: a.id, placement: a.placement, title: a.title, image_url: urls[a.image_file_id], url: a.url }));
}

/** An ad as the admin sees it: everything, its picture's link (an hour), its click rate. */
export async function adminAds<T extends { image_file_id: string; views: number; clicks: number }>(scope: Scope, ads: T[]) {
  const urls = await scope.resolve<FileModuleService>(Modules.FILE).urls(ads.map((a) => a.image_file_id));
  return ads.map((a) => ({ ...a, image_url: urls[a.image_file_id] ?? null, click_rate: a.views ? a.clicks / a.views : 0 }));
}
