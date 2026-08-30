/**
 * "Current view" here means: open the exact lat/lon our backend derived
 * from the GeoTIFF's own georeferencing in Google Maps, so you can compare
 * the AI's finding against present-day real-world imagery. No API key
 * needed for the plain link; the embed panel is optional (needs a
 * Maps Embed API key set as VITE_GOOGLE_MAPS_EMBED_KEY).
 */

export function googleMapsViewUrl(lat: number, lon: number, zoom = 17): string {
  return `https://www.google.com/maps/@${lat},${lon},${zoom}z`;
}

export function googleMapsSatelliteUrl(lat: number, lon: number, zoom = 18): string {
  return `https://www.google.com/maps/@${lat},${lon},${zoom}z/data=!3m1!1e3`;
}

export function googleMapsPinUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

const EMBED_KEY = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY as string | undefined;

export function hasEmbedKey(): boolean {
  return !!EMBED_KEY;
}

export function googleMapsEmbedUrl(lat: number, lon: number, zoom = 17): string | null {
  if (!EMBED_KEY) return null;
  const params = new URLSearchParams({
    key: EMBED_KEY,
    center: `${lat},${lon}`,
    zoom: String(zoom),
    maptype: 'satellite',
  });
  return `https://www.google.com/maps/embed/v1/view?${params.toString()}`;
}
