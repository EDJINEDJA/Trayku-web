import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/client';
import type { Credential, IdentityCheck, Member } from '@/lib/types';

export const useMembers = (query: { status?: string; q?: string; limit: number; offset: number }) =>
  useQuery({
    queryKey: ['members', query],
    queryFn: () => api<{ members: Member[]; count: number }>('/admin/members', { query }),
    placeholderData: (prev) => prev,
  });

export type MemberDetail = {
  member: Member;
  withdrawals: string[];
  no_shows?: string[];
  published: { id: string; title: string; status: string; price: number; currency_code: string; created_at: string }[];
  taken: { id: string; mission_id: string; step: string; status: string; accepted_at: string; locked_at: string | null; mission: { id: string; title: string; price: number } | null }[];
  reviews: { id: string; rating: number; comment: string | null; role: string; created_at: string }[];
  identity_checks: IdentityCheck[];
  credentials: Credential[];
};

export const useMember = (id: string) => useQuery({ queryKey: ['member', id], queryFn: () => api<MemberDetail>(`/admin/members/${id}`) });

export type MemberUpdate = { verified_id?: boolean; status?: 'active' | 'suspended'; suspended_until?: string | null; verifier?: Member['verifier'] };

export const useUpdateMember = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MemberUpdate) => api<{ member: Member }>(`/admin/members/${id}`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member', id] }).then(() => qc.invalidateQueries({ queryKey: ['members'] })),
  });
};
