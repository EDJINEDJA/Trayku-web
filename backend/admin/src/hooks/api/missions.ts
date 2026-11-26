import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/client';
import type { Dispute, Mission, Run } from '@/lib/types';

export type MissionQuery = { status?: string; q?: string; requester_id?: string; limit: number; offset: number };

export const useMissions = (query: MissionQuery) =>
  useQuery({
    queryKey: ['missions', query],
    queryFn: () => api<{ missions: Mission[]; count: number }>('/admin/missions', { query }),
    placeholderData: (prev) => prev,
  });

export type MissionDetail = {
  mission: Mission;
  runs: Run[];
  disputes: Dispute[];
  conversations: { id: string; member_a: string; member_b: string; reported_at: string | null; blocked_by: string | null }[];
};

export const useMission = (id: string) => useQuery({ queryKey: ['mission', id], queryFn: () => api<MissionDetail>(`/admin/missions/${id}`) });

export const useReviewMission = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { approve: boolean; note?: string | null }) => api(`/admin/missions/${id}/review`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mission', id] }).then(() => qc.invalidateQueries({ queryKey: ['missions'] })),
  });
};

export const useUnlockRun = (missionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => api(`/admin/runs/${runId}/unlock`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mission', missionId] }),
  });
};
