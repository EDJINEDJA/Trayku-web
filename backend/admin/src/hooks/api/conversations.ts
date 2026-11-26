import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/client';
import type { Conversation } from '@/lib/types';

export const useConversation = (id: string) =>
  useQuery({ queryKey: ['conversation', id], queryFn: () => api<{ conversation: Conversation; urls: Record<string, string> }>(`/admin/conversations/${id}`) });
