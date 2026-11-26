import { clx } from '@medusajs/ui';
import type { Tone } from '@/lib/format';

const DOT: Record<Tone, string> = {
  green: 'bg-ui-tag-green-icon',
  orange: 'bg-ui-tag-orange-icon',
  red: 'bg-ui-tag-red-icon',
  blue: 'bg-ui-tag-blue-icon',
  neutral: 'bg-ui-tag-neutral-icon',
};

/** A status: a small dot and the word, no tinted background. */
export const Status = ({ label, tone }: { label: string; tone: Tone }) => (
  <span className="inline-flex items-center gap-x-2 txt-compact-small text-ui-fg-subtle">
    <span className={clx('size-1.5 shrink-0 rounded-full', DOT[tone])} />
    {label}
  </span>
);
