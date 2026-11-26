import { Text } from '@medusajs/ui';
import { formatDateTime } from '@/lib/format';

type Item = { url: string | null; at?: string; live?: boolean };

/** Proof photos, dated; "importée" when it didn't come from the camera. A click opens it full size. */
export const Photos = ({ title, items }: { title: string; items: Item[] }) => {
  const shown = items.filter((p) => p.url);
  if (!shown.length) return null;
  return (
    <div className="flex flex-col gap-y-2 px-6 py-4">
      <Text size="small" weight="plus" leading="compact" className="text-ui-fg-subtle">
        {title}
      </Text>
      <div className="flex flex-wrap gap-2">
        {shown.map((p, i) => (
          <a key={i} href={p.url!} target="_blank" rel="noreferrer" className="flex w-24 flex-col gap-y-1">
            <img src={p.url!} alt="" className="size-24 rounded-md border object-cover" />
            <Text size="xsmall" className="text-ui-fg-muted">
              {p.at ? formatDateTime(p.at) : ''}
              {p.live === false ? ' · importée' : ''}
            </Text>
          </a>
        ))}
      </div>
    </div>
  );
};
