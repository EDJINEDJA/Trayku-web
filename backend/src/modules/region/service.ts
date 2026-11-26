import { TraikuError, TraikuService } from '@traiku/framework';
import Country from './models/country';
import Region from './models/region';

export default class RegionModuleService extends TraikuService({ Region, Country }) {
  /**
   * The region's countries become exactly these, as Medusa's: a country already in another region
   * is refused (take it out of that one first). Returns the countries the region had, to undo.
   */
  async setRegionCountries(regionId: string, iso2: string[]) {
    const codes = [...new Set(iso2.map((c) => c.toUpperCase()))];
    const found = codes.length ? await this.listCountries({ iso_2: codes }) : [];
    const unknown = codes.filter((c) => !found.some((f) => f.iso_2 === c));
    if (unknown.length) throw new TraikuError(TraikuError.Types.INVALID_DATA, `Pays inconnus : ${unknown.join(', ')}.`);
    const taken = found.filter((c) => c.region_id && c.region_id !== regionId);
    if (taken.length) {
      const owners = await this.listRegions({ id: [...new Set(taken.map((c) => c.region_id!))] });
      throw new TraikuError(
        TraikuError.Types.INVALID_DATA,
        `Déjà dans une autre région : ${taken.map((c) => `${c.display_name} (${owners.find((r) => r.id === c.region_id)?.name ?? '?'})`).join(', ')}.`,
        'country_taken'
      );
    }
    const before = (await this.listCountries({ region_id: regionId })).map((c) => c.iso_2);
    const removed = before.filter((b) => !codes.includes(b));
    const added = codes.filter((x) => !before.includes(x));
    if (removed.length) await this.updateCountries({ selector: { iso_2: removed }, data: { region_id: null } });
    if (added.length) await this.updateCountries({ selector: { iso_2: added }, data: { region_id: regionId } });
    return before;
  }
}
