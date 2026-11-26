/** "06 12 34 56 78", "+33 6…", "0033 6…" → "+33612345678". Null when it isn't a phone number. */
export function normalizePhone(input: string): string | null {
  let p = input.replace(/[\s.\-()]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (/^0\d{9}$/.test(p)) p = '+33' + p.slice(1);
  return /^\+\d{8,15}$/.test(p) ? p : null;
}


/**
 * Against SMS pumping (someone triggers SMS to numbers that pay them back): every country is
 * allowed, except premium and special ranges. Ranges a fraud ring targets are cut by the caps per
 * zone and in total (see the auth module).
 */
export const DEFAULT_BLOCKED_SMS_PREFIXES = [
  '+338', // France: 08 numbers, special and premium rates
  '+870', // Inmarsat
  '+881', // global satellite systems
  '+882', // international networks
  '+883', // international networks
  '+979', // international premium rate
  '+888', // humanitarian services
  '+991', // international trials
];

export const isSmsBlocked = (phone: string, blocked: string[]) => blocked.some((p) => phone.startsWith(p));

/** The zone of a number for the caps: country code and first digits ("+447…" for UK mobiles). */
export const smsZone = (phone: string) => phone.slice(0, 4);

export const SMS_BLOCKED_MESSAGE = 'Les SMS ne peuvent pas partir vers ce numéro (numéro spécial ou surtaxé).';
