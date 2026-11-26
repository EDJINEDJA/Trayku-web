import type { LatLng } from '../modules/mission/types';

/**
 * The road between two places, for a mission's card: a free OpenStreetMap router (OSRM), one request
 * per mission, at publication. ROUTING_URL replaces it (a paid router in production).
 */
const ROUTER = process.env.ROUTING_URL || 'https://routing.openstreetmap.de/routed-car/route/v1/driving/';
/** Enough to draw it at a card's size, far lighter to keep and to send. */
const POINTS = 150;

/** As the public sees a place: to about 1 km (api/utils/serialize.ts, area). */
export const publicPoint = (p: LatLng): LatLng => ({ latitude: Math.round(p.latitude * 100) / 100, longitude: Math.round(p.longitude * 100) / 100 });

/** The driving road from a to b, thinned to POINTS; null when there is none or the router doesn't answer. */
export async function roadPath(a: LatLng, b: LatLng): Promise<LatLng[] | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(`${ROUTER}${a.longitude},${a.latitude};${b.longitude},${b.latitude}?alternatives=false&overview=full&geometries=geojson`, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Trayku-backend' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { routes?: { geometry?: { coordinates?: [number, number][] } }[] };
    const coords = data.routes?.[0]?.geometry?.coordinates;
    if (!coords?.length) return null;
    const pts = coords.map(([lon, lat]) => ({ latitude: Number(lat.toFixed(5)), longitude: Number(lon.toFixed(5)) }));
    if (pts.length <= POINTS) return pts;
    const step = (pts.length - 1) / (POINTS - 1);
    return Array.from({ length: POINTS }, (_, i) => pts[Math.round(i * step)]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
