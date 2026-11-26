import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/client';

export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ user: { id: string; email: string; first_name: string | null } }>('/admin/users/me'),
    retry: false,
  });

/** Email and password give a token, at once turned into the session cookie, then forgotten. */
export const useLogin = () =>
  useMutation({
    mutationFn: async (body: { email: string; password: string }) => {
      const { token } = await api<{ token: string }>('/auth/user/emailpass', { method: 'POST', body });
      await api('/auth/session', { method: 'POST', token });
    },
  });
