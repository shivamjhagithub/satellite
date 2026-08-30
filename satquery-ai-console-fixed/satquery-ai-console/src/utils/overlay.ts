import { PixelBox, WgsBoundingBox } from '../types/api';

export interface FractionalBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A shape to draw over a result image, in 0..1 fractions of the image's
 * own width/height — independent of however large the <img> is rendered.
 */
export interface OverlayShape {
  id: string;
  kind: 'box' | 'polygon';
  color: string;
  label?: string;
  box?: FractionalBox;
  /** One array of [x,y] fractional points per ring (outer ring only is drawn). */
  rings?: [number, number][][];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Converts a detection's real pixel box (backend-computed — see
 * Detection.sourcePixel / Detection.pixel) into a fractional box, using the
 * source raster's own pixel width/height. Never invents a box: returns null
 * if either dimension is missing or zero.
 */
export function pixelBoxToFractionalBox(box: PixelBox, imageWidth: number | null | undefined, imageHeight: number | null | undefined): FractionalBox | null {
  if (!imageWidth || !imageHeight) return null;
  const x1 = Math.min(box.x1, box.x2);
  const x2 = Math.max(box.x1, box.x2);
  const y1 = Math.min(box.y1, box.y2);
  const y2 = Math.max(box.y1, box.y2);
  return {
    x: clamp01(x1 / imageWidth),
    y: clamp01(y1 / imageHeight),
    w: clamp01((x2 - x1) / imageWidth),
    h: clamp01((y2 - y1) / imageHeight),
  };
}

/**
 * Maps a single WGS84 ring onto the 0..1 fractional space of a raster using
 * the raster's own reprojected bounding box as the frame (the same
 * boundingBox the backend already put on geoReferences[]). This assumes a
 * north-up, unrotated raster — true for the assets this app handles — it is
 * a linear fit against bounds the backend already computed, not a new
 * reprojection and not an invented coordinate.
 */
export function geoRingToFractionalPoints(ring: number[][], bbox: WgsBoundingBox): [number, number][] {
  const lonSpan = bbox.maxLongitude - bbox.minLongitude;
  const latSpan = bbox.maxLatitude - bbox.minLatitude;
  if (!lonSpan || !latSpan) return [];
  return ring
    .filter((pt) => Array.isArray(pt) && typeof pt[0] === 'number' && typeof pt[1] === 'number')
    .map(([lon, lat]) => [clamp01((lon - bbox.minLongitude) / lonSpan), clamp01((bbox.maxLatitude - lat) / latSpan)] as [number, number]);
}

export function geoPolygonToFractionalRings(
  geometry: { type: string; coordinates: number[][][] } | null | undefined,
  bbox: WgsBoundingBox | null | undefined
): [number, number][][] {
  if (!geometry || !bbox) return [];
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as unknown as number[][][][]).flatMap((poly) => [geoRingToFractionalPoints(poly[0] ?? [], bbox)]);
  }
  const outerRing = geometry.coordinates[0];
  if (!outerRing) return [];
  return [geoRingToFractionalPoints(outerRing, bbox)];
}