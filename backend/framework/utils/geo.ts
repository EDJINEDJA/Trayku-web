export type LatLng = { latitude: number; longitude: number };

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distance in metres between two points. */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
