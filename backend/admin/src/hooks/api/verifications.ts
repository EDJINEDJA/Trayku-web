import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/client';
import type { Credential, IdentityCheck } from '@/lib/types';

type Page = { status: string; limit: number; offset: number };
type Review = { id: string; approve: boolean; reason?: string };

export const useIdentityChecks = (query: Page) =>
  useQuery({
    queryKey: ['identity-checks', query],
    queryFn: () => api<{ identity_checks: IdentityCheck[]; count: number }>('/admin/identity-checks', { query }),
    placeholderData: (prev) => prev,
  });

export const useReviewIdentity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Review) => api(`/admin/identity-checks/${id}/review`, { method: 'POST', body }),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['identity-checks'] }), qc.invalidateQueries({ queryKey: ['member'] })]),
  });
};

export const useCredentials = (query: Page) =>
  useQuery({
    queryKey: ['credentials', query],
    queryFn: () => api<{ credentials: Credential[]; count: number }>('/admin/credentials', { query }),
    placeholderData: (prev) => prev,
  });

export const useReviewCredential = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Review) => api(`/admin/credentials/${id}/review`, { method: 'POST', body }),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['credentials'] }), qc.invalidateQueries({ queryKey: ['member'] })]),
  });
};
