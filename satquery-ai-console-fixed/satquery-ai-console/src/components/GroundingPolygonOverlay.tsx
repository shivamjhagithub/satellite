import React from 'react';
import { Detection, GeoReference } from '../types/api';
import { colorForSource } from '../utils/location';

/**
 * Fallback for GROUNDING results when the backend didn't return a
 * `groundingOverlayObjectKey` (overlay generation skipped/failed, or the
 * field simply came back empty). The coordinates themselves are still on
 * the result payload — this draws them client-side as an SVG so the user
 * isn't left with numbers in a table and no visual.
 *
 * Renders each detection's polygon ring when `geometry.coordinates` is
 * present, and falls back further to a point marker (from `location` or
 * `geometry.centroid`) for detections that only carry a coordinate pair.
 */

const VIEW_SIZE = 400;
const PADDING_FRACTION = 0.12; // headroom so polygons touching the edge aren't clipped
const MIN_SPAN_DEGREES = 0.0005; // guards against a zero-width/height bbox (single point, etc.)

interface Bounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

function boundsFromGeoReferences(geoReferences?: GeoReference[]): Bounds | null {
  const bbox = geoReferences?.[0]?.boundingBox;
  if (
    !bbox ||
    typeof bbox.minLatitude !== 'number' ||
    typeof bbox.maxLatitude !== 'number' ||
    typeof bbox.minLongitude !== 'number' ||
    typeof bbox.maxLongitude !== 'number'
  ) {
    return null;
  }
  return {
    minLat: bbox.minLatitude,
    maxLat: bbox.maxLatitude,
    minLon: bbox.minLongitude,
    maxLon: bbox.maxLongitude,
  };
}

function boundsFromDetections(detections: Detection[]): Bounds | null {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  let found = false;

  const consider = (lat: unknown, lon: unknown) => {
    if (typeof lat === 'number' && typeof lon === 'number' && !Number.isNaN(lat) && !Number.isNaN(lon)) {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      found = true;
    }
  };

  detections.forEach((d) => {
    const ring = d.geometry?.coordinates?.[0];
    if (Array.isArray(ring)) {
      ring.forEach((pt) => {
        // GeoJSON order is [lon, lat]
        if (Array.isArray(pt) && pt.length >= 2) consider(pt[1], pt[0]);
      });
    }
    const loc = d.location ?? d.geometry?.centroid;
    if (loc) consider(loc.latitude, loc.longitude);
  });

  return found ? { minLat, maxLat, minLon, maxLon } : null;
}

function padBounds(b: Bounds): Bounds {
  let latSpan = b.maxLat - b.minLat;
  let lonSpan = b.maxLon - b.minLon;
  if (latSpan < MIN_SPAN_DEGREES) latSpan = MIN_SPAN_DEGREES;
  if (lonSpan < MIN_SPAN_DEGREES) lonSpan = MIN_SPAN_DEGREES;
  const latPad = latSpan * PADDING_FRACTION;
  const lonPad = lonSpan * PADDING_FRACTION;
  const centerLat = (b.maxLat + b.minLat) / 2;
  const centerLon = (b.maxLon + b.minLon) / 2;
  return {
    minLat: centerLat - latSpan / 2 - latPad,
    maxLat: centerLat + latSpan / 2 + latPad,
    minLon: centerLon - lonSpan / 2 - lonPad,
    maxLon: centerLon + lonSpan / 2 + lonPad,
  };
}

export const GroundingPolygonOverlay: React.FC<{
  detections: Detection[];
  geoReferences?: GeoReference[];
}> = ({ detections, geoReferences }) => {
  const rawBounds = boundsFromGeoReferences(geoReferences) ?? boundsFromDetections(detections);

  if (!rawBounds) {
    return (
      <div className="hint" style={{ padding: 16 }}>
        No coordinates available to plot.
      </div>
    );
  }

  const bounds = padBounds(rawBounds);
  const latSpan = bounds.maxLat - bounds.minLat;
  const lonSpan = bounds.maxLon - bounds.minLon;

  const toX = (lon: number) => ((lon - bounds.minLon) / lonSpan) * VIEW_SIZE;
  // Flip Y: latitude increases upward, SVG y increases downward.
  const toY = (lat: number) => ((bounds.maxLat - lat) / latSpan) * VIEW_SIZE;

  const color = colorForSource('GROUNDING');
  const anyModelGenerated = detections.some((d) => d.coordinatesAreModelGenerated);

  return (
    <div>
      <svg
        viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
        width="100%"
        height="auto"
        style={{ display: 'block', background: 'var(--bg)' }}
      >
        <rect x={0} y={0} width={VIEW_SIZE} height={VIEW_SIZE} fill="var(--bg)" />
        {detections.map((d, i) => {
          const ring = d.geometry?.coordinates?.[0];
          const loc = d.location ?? d.geometry?.centroid;

          if (Array.isArray(ring) && ring.length >= 3) {
            const points = ring
              .filter((pt) => Array.isArray(pt) && pt.length >= 2)
              .map((pt) => `${toX(pt[0]).toFixed(1)},${toY(pt[1]).toFixed(1)}`)
              .join(' ');
            const labelX = loc ? toX(loc.longitude) : toX(ring[0][0]);
            const labelY = loc ? toY(loc.latitude) : toY(ring[0][1]);
            return (
              <g key={i}>
                <polygon points={points} fill={color} fillOpacity={0.22} stroke={color} strokeWidth={2} />
                {d.label && (
                  <text
                    x={labelX}
                    y={labelY - 6}
                    fontSize={11}
                    fontFamily="var(--mono)"
                    fill={color}
                    textAnchor="middle"
                    style={{ paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 3 }}
                  >
                    {d.label}
                  </text>
                )}
              </g>
            );
          }

          // No polygon ring — fall back to a point marker for this detection.
          if (loc) {
            const cx = toX(loc.longitude);
            const cy = toY(loc.latitude);
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={5} fill={color} stroke="var(--bg)" strokeWidth={1.5} />
                {d.label && (
                  <text
                    x={cx}
                    y={cy - 9}
                    fontSize={11}
                    fontFamily="var(--mono)"
                    fill={color}
                    textAnchor="middle"
                    style={{ paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 3 }}
                  >
                    {d.label}
                  </text>
                )}
              </g>
            );
          }

          return null;
        })}
      </svg>
      <div className="hint" style={{ marginTop: 4 }}>
        Plotted from detection coordinates — server overlay image not available.
        {anyModelGenerated ? ' Some coordinates are model-estimated, not sensor-exact.' : ''}
      </div>
    </div>
  );
};
