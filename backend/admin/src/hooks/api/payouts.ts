import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/client';
import type { AdminBalance, AdminPayout, Wallet } from '@/lib/types';

export const usePayouts = (query: { status: string; limit: number; offset: number }) =>
  useQuery({
    queryKey: ['payouts', query],
    queryFn: () => api<{ payouts: AdminPayout[]; count: number; provider_id: string; mode: 'test' | 'live' }>('/admin/payouts', { query }),
    placeholderData: (prev) => prev,
  });

export const useBalances = (query: { limit: number; offset: number }) =>
  useQuery({
    queryKey: ['payout-balances', query],
    queryFn: () => api<{ balances: AdminBalance[]; count: number }>('/admin/payouts/balances', { query }),
    placeholderData: (prev) => prev,
  });

export const useMemberWallet = (id: string) => useQuery({ queryKey: ['wallet', id], queryFn: () => api<Wallet>(`/admin/members/${id}/wallet`) });

/** After any change: the lists and the wallets read again. */
const refresh = (qc: ReturnType<typeof useQueryClient>) =>
  Promise.all([qc.invalidateQueries({ queryKey: ['payouts'] }), qc.invalidateQueries({ queryKey: ['payout-balances'] }), qc.invalidateQueries({ queryKey: ['wallet'] })]);

export const usePayMember = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api<{ payouts: AdminPayout[] }>(`/admin/members/${id}/payout`, { method: 'POST' }), onSuccess: () => refresh(qc) });
};

export const useRetryPayout = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api(`/admin/payouts/${id}/retry`, { method: 'POST' }), onSuccess: () => refresh(qc) });
};

export const useHoldPayouts = (id: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: { hold: boolean; reason?: string | null }) => api(`/admin/members/${id}/payout-hold`, { method: 'POST', body }), onSuccess: () => refresh(qc) });
};

export const useCancelMissionEarnings = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (missionId: string) => api<{ canceled: number }>(`/admin/missions/${missionId}/earnings/cancel`, { method: 'POST' }), onSuccess: () => refresh(qc) });
};

/** The CSV of the payouts between two dates, downloaded with the team's session. */
export async function downloadPayouts(from: string, to: string) {
  const res = await fetch(`/admin/payouts/export?${new URLSearchParams({ from, to })}`, { credentials: 'same-origin', headers: { Accept: 'text/csv' } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Export impossible.');
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: `virements-${from}-${to}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}
