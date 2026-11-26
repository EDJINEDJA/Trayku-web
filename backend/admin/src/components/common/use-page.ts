import { useSearchParams } from 'react-router-dom';

/** The list's page, tab and search in the address, so a refresh or a shared link keeps them. */
export function useListParams(defaults: { tab?: string } = {}) {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') ?? 0) || 0;
  const tab = params.get('tab') ?? defaults.tab ?? '';
  const q = params.get('q') ?? '';
  const set = (next: Record<string, string | number | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) v === null || v === '' ? p.delete(k) : p.set(k, String(v));
    setParams(p, { replace: true });
  };
  return { page, tab, q, setPage: (n: number) => set({ page: n || null }), setTab: (t: string) => set({ tab: t, page: null }), setQ: (v: string) => set({ q: v, page: null }) };
}
