import {
  AnalysisResponse,
  ChangeResult,
  GroundingResult,
  CompatibilityResponse,
  AlignResponse,
} from '../types/api';

export interface PlottedLocation {
  lat: number;
  lon: number;
  label: string;
  source: 'CAPTION' | 'VQA' | 'GROUNDING' | 'CHANGE' | 'FUSION' | 'CHAT' | 'COMPATIBILITY' | 'PROCESSING_PLAN' | 'ALIGN' | 'MANUAL';
}

/**
 * Pulls only coordinates the backend actually returned — never invents any.
 * See contract §44: "Do not invent coordinates."
 */
export function extractLocations(
  type: PlottedLocation['source'],
  result: unknown,
  assetAName?: string | null,
  assetBName?: string | null
): PlottedLocation[] {
  const r = (result ?? {}) as Record<string, any>;
  const out: PlottedLocation[] = [];
  const push = (lat: unknown, lon: unknown, label: string) => {
    if (typeof lat === 'number' && typeof lon === 'number' && !Number.isNaN(lat) && !Number.isNaN(lon)) {
      out.push({ lat, lon, label, source: type });
    }
  };

  // geoReferences[] — Caption / VQA / Ground / Change / Fusion
  const geoRefs = r.geoReferences as Array<{ latitude: number; longitude: number }> | undefined;
  if (Array.isArray(geoRefs)) {
    geoRefs.forEach((g, i) => {
      const label =
        geoRefs.length > 1
          ? i === 0
            ? assetAName ?? 'Asset A'
            : assetBName ?? 'Asset B'
          : assetAName ?? 'Scene center';
      push(g?.latitude, g?.longitude, label);
    });
  }

  // Change detection
  const change = r as Partial<ChangeResult>;
  if (change.changeGeoJson?.centroid) push(change.changeGeoJson.centroid.latitude, change.changeGeoJson.centroid.longitude, 'Change centroid');
  if (change.changeCentroid) push(change.changeCentroid.latitude, change.changeCentroid.longitude, 'Change centroid');

  // Grounding detections
  const grounding = r as Partial<GroundingResult>;
  if (Array.isArray(grounding.detections)) {
    grounding.detections.forEach((d) => {
      const loc = d.location ?? d.geometry?.centroid;
      if (loc) push(loc.latitude, loc.longitude, d.label || 'Detection');
    });
  }

  // Compatibility / Processing plan — both assets carry a wgs84 center
  const compat = r as Partial<CompatibilityResponse>;
  if (compat.assetA?.wgs84) push(compat.assetA.wgs84.latitude, compat.assetA.wgs84.longitude, assetAName ?? 'Asset A center');
  if (compat.assetB?.wgs84) push(compat.assetB.wgs84.latitude, compat.assetB.wgs84.longitude, assetBName ?? 'Asset B center');

  // Align — single merged wgs84
  const align = r as Partial<AlignResponse>;
  if (align.wgs84 && !compat.assetA) push(align.wgs84.latitude, align.wgs84.longitude, 'Aligned output center');

  // de-dupe near-identical points
  const seen = new Set<string>();
  return out.filter((p) => {
    const k = `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function extractFromAnalysis(entry: AnalysisResponse, assetAName?: string | null, assetBName?: string | null) {
  return extractLocations(entry.type as PlottedLocation['source'], entry.result, assetAName, assetBName);
}

export function colorForSource(source: PlottedLocation['source']): string {
  switch (source) {
    case 'CHANGE':
      return '#f87171'; // red
    case 'GROUNDING':
      return '#f5a623'; // amber
    case 'COMPATIBILITY':
    case 'PROCESSING_PLAN':
    case 'ALIGN':
      return '#4ade80'; // green
    default:
      return '#ff7a21'; // saffron
  }
}
