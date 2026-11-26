import { Container, Heading, Text, clx } from '@medusajs/ui';
import type { PropsWithChildren, ReactNode } from 'react';

/** A card of a page, as Medusa's: a heading row, then its rows separated by lines. */
export const Section = ({ title, actions, children, className }: PropsWithChildren<{ title?: ReactNode; actions?: ReactNode; className?: string }>) => (
  <Container className={clx('divide-y p-0', className)}>
    {(title || actions) && (
      <div className="flex items-center justify-between gap-x-4 px-6 py-4">
        {typeof title === 'string' ? <Heading level="h2">{title}</Heading> : title}
        {actions && <div className="flex items-center gap-x-2">{actions}</div>}
      </div>
    )}
    {children}
  </Container>
);

/** A label and its value, as Medusa's SectionRow. */
export const SectionRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="grid grid-cols-2 items-start gap-x-4 px-6 py-4 text-ui-fg-subtle">
    <Text size="small" weight="plus" leading="compact">
      {label}
    </Text>
    <div className="txt-compact-small break-words text-ui-fg-base">{value ?? '—'}</div>
  </div>
);

/** A page with a main column and a side one, stacked on small screens. */
export const TwoColumnPage = ({ main, side }: { main: ReactNode; side: ReactNode }) => (
  <div className="flex flex-col gap-y-3 xl:flex-row xl:items-start xl:gap-x-4">
    <div className="flex min-w-0 flex-1 flex-col gap-y-3">{main}</div>
    <div className="flex w-full flex-col gap-y-3 xl:max-w-[420px]">{side}</div>
  </div>
);

export const Empty = ({ children }: PropsWithChildren) => (
  <div className="px-6 py-8">
    <Text size="small" className="text-ui-fg-muted">
      {children}
    </Text>
  </div>
);
