import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/client';
import type { Area, Pricing, PricingVersion, Region } from '@/lib/types';

export const usePricing = (regionId: string | null) =>
  useQuery({
    queryKey: ['pricing', regionId],
    queryFn: () =>
      api<{ regions: Region[]; areas: Record<Area, string>; region: Region; pricing: Pricing; defaults: Pricing; history: PricingVersion[] }>('/admin/pricing', { query: { region_id: regionId } }),
  });

export const useSavePricing = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { region_id: string; pricing: Pricing; note?: string | null }) => api<{ pricing: Pricing }>('/admin/pricing', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing'] }),
  });
};
