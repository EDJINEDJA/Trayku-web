import { ArrowRightOnRectangle, Cash, ChatBubbleLeftRight, DocumentText, ExclamationCircle, GlobeEurope, Key, Photo, ReceiptPercent, ShieldCheck, SquaresPlus, Users } from '@medusajs/icons';
import { Text, clx } from '@medusajs/ui';
import type { ComponentType } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMe } from '@/hooks/api/auth';
import { api } from '@/lib/client';
import { queryClient } from '@/providers/app-providers';

const NAV: { to: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { to: '/missions', label: 'Missions', icon: SquaresPlus },
  { to: '/members', label: 'Membres', icon: Users },
  { to: '/verifications', label: 'Vérifications', icon: ShieldCheck },
  { to: '/disputes', label: 'Litiges', icon: ExclamationCircle },
  { to: '/payouts', label: 'Virements', icon: Cash },
  { to: '/support', label: 'Support', icon: ChatBubbleLeftRight },
  { to: '/pricing', label: 'Tarifs', icon: ReceiptPercent },
  { to: '/ads', label: 'Publicités', icon: Photo },
  { to: '/settings/regions', label: 'Régions', icon: GlobeEurope },
  { to: '/settings/api-keys', label: 'Clés API', icon: Key },
  { to: '/settings/journal', label: 'Journal', icon: DocumentText },
];

/** The shell, as Medusa's: the sidebar on the left, the page on the right. */
export const MainLayout = () => {
  const { data } = useMe();
  const navigate = useNavigate();
  const logout = async () => {
    // The token behind the cookie is revoked on the server, and the cookie removed.
    await api('/auth/session', { method: 'DELETE' }).catch(() => {});
    queryClient.clear();
    navigate('/login', { replace: true });
  };
  return (
    <div className="flex h-full">
      <aside className="flex w-[220px] shrink-0 flex-col justify-between border-r bg-ui-bg-subtle">
        <div>
          <div className="px-4 py-4">
            <Text size="large" weight="plus" leading="compact">
              Traiku
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted">
              Administration
            </Text>
          </div>
          <nav className="flex flex-col gap-y-0.5 px-3">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clx(
                    'flex items-center gap-x-2 rounded-md px-2 py-1.5 txt-compact-small-plus text-ui-fg-subtle transition-fg hover:bg-ui-bg-subtle-hover',
                    isActive && 'bg-ui-bg-base text-ui-fg-base shadow-elevation-card-rest hover:bg-ui-bg-base'
                  )
                }
              >
                <Icon className="text-ui-fg-subtle" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-y-1 border-t px-3 py-3">
          <Text size="xsmall" className="truncate px-2 text-ui-fg-muted">
            {data?.user.email}
          </Text>
          <button onClick={logout} className="flex items-center gap-x-2 rounded-md px-2 py-1.5 txt-compact-small-plus text-ui-fg-subtle hover:bg-ui-bg-subtle-hover">
            <ArrowRightOnRectangle className="text-ui-fg-subtle" />
            Se déconnecter
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-y-3 p-3">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
