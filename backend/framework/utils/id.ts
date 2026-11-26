import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** A ULID: sortable by creation time, 26 characters. */
export function ulid(now = Date.now()): string {
  let t = now;
  let time = '';
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  let random = '';
  for (const b of randomBytes(16)) random += ALPHABET[b % 32];
  return time + random;
}

/** "mis_01J…": the prefix tells what the id is, as Medusa's ids. */
export const generateEntityId = (prefix?: string) => (prefix ? `${prefix}_${ulid()}` : ulid());
