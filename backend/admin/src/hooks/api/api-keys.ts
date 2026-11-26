import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/client';
import type { ApiKey } from '@/lib/types';

export const useApiKeys = () => useQuery({ queryKey: ['api-keys'], queryFn: () => api<{ api_keys: ApiKey[] }>('/admin/api-keys') });

export const useCreateApiKey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; type: ApiKey['type'] }) => api<{ api_key: ApiKey }>('/admin/api-keys', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });
};

export const useRevokeApiKey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/admin/api-keys/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });
};
