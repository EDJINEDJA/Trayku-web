import { TraikuService } from '@traiku/framework';
import Brand from './models/brand';

export type BrandKind = 'store' | 'relay' | 'drive' | 'pressing' | 'other';

/** « Leroy Merlin », « leroy-merlin », « LEROY MERLIN » are one: the key the brands are told apart by. */
export const brandKey = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export default class BrandModuleService extends TraikuService({ Brand }) {}
