import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/client';
import type { Dispute } from '@/lib/types';

export const useDisputes = (query: { status: string; limit: number; offset: number }) =>
  useQuery({
    queryKey: ['disputes', query],
    queryFn: () => api<{ disputes: Dispute[]; count: number }>('/admin/disputes', { query }),
    placeholderData: (prev) => prev,
  });

export const useResolveDispute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: 'resolved' | 'rejected'; resolution: string }) => api(`/admin/disputes/${id}/resolve`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['disputes'] }).then(() => qc.invalidateQueries({ queryKey: ['mission'] })),
  });
};
