import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/client';
import type { Country, Currency, Region } from '@/lib/types';

/** As Medusa's admin hooks: useRegions, useRegion, useCreateRegion, useUpdateRegion, useDeleteRegion. */
export type RegionBody = Omit<Region, 'id'>;

export const useRegions = () => useQuery({ queryKey: ['regions'], queryFn: () => api<{ regions: Region[]; count: number }>('/admin/regions') });
export const useRegion = (id: string) => useQuery({ queryKey: ['regions', id], queryFn: () => api<{ region: Region }>(`/admin/regions/${id}`) });
export const useCurrencies = () => useQuery({ queryKey: ['currencies'], queryFn: () => api<{ currencies: Currency[] }>('/admin/currencies'), staleTime: Infinity });
export const useCountries = () => useQuery({ queryKey: ['countries'], queryFn: () => api<{ countries: Country[] }>('/admin/countries') });

const useInvalidate = () => {
  const qc = useQueryClient();
  return () => Promise.all(['regions', 'countries', 'pricing'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
};

export const useCreateRegion = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body: RegionBody) => api<{ region: Region }>('/admin/regions', { method: 'POST', body }), onSuccess: invalidate });
};
export const useUpdateRegion = (id: string) => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body: Partial<RegionBody>) => api<{ region: Region }>(`/admin/regions/${id}`, { method: 'POST', body }), onSuccess: invalidate });
};
export const useDeleteRegion = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api(`/admin/regions/${id}`, { method: 'DELETE' }), onSuccess: invalidate });
};
