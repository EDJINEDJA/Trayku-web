import { COMMON } from './common';
import { BIKE, IT, MECHANIC } from './repair';
import { ELECTRONICS, FURNITURE, WATCHMAKER } from './craft';
import { ELECTRICIAN, LOCKSMITH, PAINTER, PLUMBER } from './building';
import { CLEANER, DRIVER, GARDENER, MOVER } from './services';
import type { Q } from './types';

export { PASS_SCORE, RETRY_DAYS, TEST_SIZE } from './types';

/** The trade's own questions (24), by trade id (lib/identity TRADES). */
const BY_TRADE: Record<string, Q[]> = {
  mechanic: MECHANIC,
  bike: BIKE,
  it: IT,
  electronics: ELECTRONICS,
  watchmaker: WATCHMAKER,
  furniture: FURNITURE,
  electrician: ELECTRICIAN,
  plumber: PLUMBER,
  painter: PAINTER,
  locksmith: LOCKSMITH,
  gardener: GARDENER,
  mover: MOVER,
  driver: DRIVER,
  cleaner: CLEANER,
};

export type Question = { id: string; q: string; options: string[]; answer: number; why: string };

/** A trade's test: the 6 ground questions, then its 24 own; null for a trade without one (written by the member). */
export function certificateTest(trade: string): Question[] | null {
  const own = BY_TRADE[trade];
  if (!own) return null;
  return [...COMMON.map((q, i) => ({ q, id: `c${i}` })), ...own.map((q, i) => ({ q, id: `t${i}` }))].map(({ q: [q, options, answer, why], id }) => ({ id, q, options, answer, why }));
}

/** The trades that have a test. */
export const CERTIFIED_TRADES = Object.keys(BY_TRADE);
