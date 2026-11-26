import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/client';
import type { AdminSupportRequest } from '@/lib/types';

export const useSupportRequests = () => useQuery({ queryKey: ['support'], queryFn: () => api<{ requests: AdminSupportRequest[]; count: number }>('/admin/support') });

export const useAnswerSupport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, answer, close }: { id: string; answer: string; close: boolean }) => api(`/admin/support/${id}/answer`, { method: 'POST', body: { answer, close } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support'] }),
  });
};
