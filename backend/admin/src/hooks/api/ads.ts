import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/client';
import type { AdminAd } from '@/lib/types';

export type AdBody = {
  sponsor: string;
  title: string;
  image_file_id: string;
  url: string;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
};

export const useAds = () => useQuery({ queryKey: ['ads'], queryFn: () => api<{ ads: AdminAd[]; count: number }>('/admin/ads') });

export const useSaveAd = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Partial<AdBody> }) => api<{ ad: AdminAd }>(id ? `/admin/ads/${id}` : '/admin/ads', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ads'] }),
  });
};

export const useDeleteAd = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/admin/ads/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ads'] }),
  });
};

/** The picture, sent alone (multipart): its id for the ad, a link to preview it. */
export const useUploadImage = () =>
  useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('files', file);
      const res = await fetch('/admin/uploads', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' }, body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(res.status, json.type ?? 'unknown_error', json.message ?? 'Envoi impossible.');
      return json.file as { id: string; url: string };
    },
  });
