/**
 * Certificat Traiku: a test by trade, for a member without a diploma. Each question is written as
 * [question, options, index of the right one, why]. The answers stay here, on the server: the app gets
 * the questions alone, then the corrections once the test is sent.
 */
export type Q = [q: string, options: string[], answer: number, why: string];

/** Questions in a test, and the right answers it takes (80 %). */
export const TEST_SIZE = 30;
export const PASS_SCORE = 24;
/** After a failed test, the next try opens this many days later. */
export const RETRY_DAYS = 7;
