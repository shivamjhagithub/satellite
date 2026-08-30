import React, { useEffect, useState } from 'react';
import { useApp, HistoryEntry } from '../state/AppContext';
import { JsonView } from '../components/JsonView';
import { ResultImage } from '../components/ResultImage';
import { extractLocations } from '../utils/location';
import { googleMapsPinUrl } from '../utils/googleMaps';
import { OverlayShape, pixelBoxToFractionalBox, geoPolygonToFractionalRings } from '../utils/overlay';
import {
  ChangeResult,
  CompatibilityResponse,
  GroundingResult,
  TilesResponse,
  AlignResponse,
  FusionResult,
} from '../types/api';
import { SatQueryClient } from '../api/client';

function fmtNum(n: unknown): string {
  if (typeof n !== 'number') return '—';
  return (Math.round(n * 1000) / 1000).toString();
}

/**
 * Renders a stored object (change map, change visualization, grounding
 * overlay, fusion output, ...) directly by objectKey. Used wherever the
 * key comes straight off the result payload — no extra fetch needed.
 */
const ObjectImage: React.FC<{
  client: SatQueryClient;
  label: string;
  objectKey: string | null | undefined;
  shapes?: OverlayShape[];
}> = ({ client, label, objectKey, shapes }) => (
  <ResultImage label={label} src={objectKey ? client.objectUrl(objectKey) : undefined} shapes={shapes} />
);

/**
 * Renders a raster asset's preview by assetId. Asset previews aren't stored
 * on the result payload — they have to be requested (and generated on first
 * request) via GET /api/assets/{id}/preview, so this fetches that key first
 * and then hands it to ObjectImage.
 */
const AssetPreviewImage: React.FC<{
  client: SatQueryClient;
  label: string;
  assetId: string | null | undefined;
  shapes?: OverlayShape[];
}> = ({ client, label, assetId, shapes }) => {
  const [objectKey, setObjectKey] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!assetId) {
      setObjectKey(null);
      return;
    }
    setObjectKey(undefined);
    client
      .getAssetPreview(assetId)
      .then((r) => {
        if (!cancelled) setObjectKey(r.objectKey);
      })
      .catch(() => {
        if (!cancelled) setObjectKey(null);
      });
    return () => {
      cancelled = true;
    };
  }, [client, assetId]);

  return <ObjectImage client={client} label={label} objectKey={objectKey} shapes={shapes} />;
};

const ResultBody: React.FC<{ entry: HistoryEntry; onFocus: (lat: number, lon: number) => void }> = ({ entry, onFocus }) => {
  const { client, assetById } = useApp();
  const r = (entry.result ?? {}) as Record<string, any>;
const locs = entry.type === 'TILES' ? [] : extractLocations(entry.type, entry.result, entry.assetAName, entry.assetBName);
  let stats: React.ReactNode = null;
  let images: React.ReactNode = null;

  if (entry.type === 'CHANGE') {
    const cr = r as ChangeResult;
    // Draw each change feature's real polygon on top of the change images —
    // mapped from its WGS84 geometry into the raster's own bounding box
    // (from geoReferences[].boundingBox), not just listed as a centroid.
    const changeBBox = cr.geoReferences?.[0]?.boundingBox ?? cr.geoReferences?.[1]?.boundingBox;
    const changeShapes: OverlayShape[] = (cr.changeGeoJson?.features ?? []).flatMap((f, i) => {
      const rings = geoPolygonToFractionalRings(f.geometry, changeBBox);
      if (!rings.length || !rings[0].length) return [];
      return [
        {
          id: `chg-${i}`,
          kind: 'polygon' as const,
          color: '#f87171',
          label: `Change feature ${i + 1}${f.properties?.areaHectares != null ? ` (${f.properties.areaHectares.toFixed(3)} ha)` : ''}`,
          rings,
        },
      ];
    });
    stats = (
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Changed area</div>
          <div className="stat-val">{fmtNum(cr.changedAreaHectares)} ha</div>
        </div>
        <div className="stat">
          <div className="stat-label">Change features</div>
          <div className="stat-val">{cr.changeFeatureCount ?? '—'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Changed fraction</div>
          <div className="stat-val">{cr.changedFraction != null ? (cr.changedFraction * 100).toFixed(2) + '%' : '—'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Threshold</div>
          <div className="stat-val">{fmtNum(cr.threshold)}</div>
        </div>
      </div>
    );
    images = (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          margin: '14px 0',
        }}
      >
        <AssetPreviewImage client={client} label="Before" assetId={entry.assetAId} shapes={changeShapes} />
        <AssetPreviewImage client={client} label="After" assetId={entry.assetBId} shapes={changeShapes} />
        <ObjectImage client={client} label="Change map" objectKey={cr.changeMapObjectKey} shapes={changeShapes} />
        <ObjectImage
          client={client}
          label="Change visualization"
          objectKey={cr.changeVisualizationObjectKey}
          shapes={changeShapes}
        />
      </div>
    );
    if (changeShapes.length === 0 && (cr.changeGeoJson?.features?.length ?? 0) > 0) {
      images = (
        <>
          {images}
          <div className="hint" style={{ marginBottom: 10 }}>
            Change features were returned but no raster bounding box was available to place them on the image — outlines are
            omitted rather than guessed.
          </div>
        </>
      );
    }
  } else if (entry.type === 'COMPATIBILITY' || entry.type === 'PROCESSING_PLAN') {
    const cr = r as CompatibilityResponse;
    stats = (
      <>
        <div className="stat-grid">
          <div className="stat">
            <div className="stat-label">Compatible</div>
            <div className="stat-val">{cr.compatible ? 'Yes' : 'No'}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Overlap</div>
            <div className="stat-val">{cr.overlap ? 'Yes' : 'No'}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Same CRS</div>
            <div className="stat-val">{cr.sameCrs ? 'Yes' : 'No'}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Same grid</div>
            <div className="stat-val">{cr.sameGrid ? 'Yes' : 'No'}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Needs reprojection</div>
            <div className="stat-val">{cr.requiresReprojection ? 'Yes' : 'No'}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Needs alignment</div>
            <div className="stat-val">{cr.requiresAlignment ? 'Yes' : 'No'}</div>
          </div>
        </div>
        {cr.reasons?.length ? <div className="answer-box">{cr.reasons.join('\n')}</div> : null}
      </>
    );
  } else if (entry.type === 'TILES') {
    const tr = r as TilesResponse;
    stats = (
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Tiles generated</div>
          <div className="stat-val">{tr.tiles?.length ?? 0}</div>
        </div>
      </div>
    );
  } else if (entry.type === 'ALIGN') {
    const ar = r as AlignResponse;
    stats = (
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Output key</div>
          <div className="stat-val" style={{ fontSize: 11 }}>
            {ar.objectKey ?? '—'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Width × Height</div>
          <div className="stat-val">{ar.width && ar.height ? `${ar.width}×${ar.height}` : '—'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">CRS</div>
          <div className="stat-val">{ar.crs ?? '—'}</div>
        </div>
      </div>
    );
  }

  const detections = (r as Partial<GroundingResult>).detections;
  const groundingOverlayObjectKey = (r as Partial<GroundingResult>).groundingOverlayObjectKey;
  const fusionObjectKey = (r as Partial<FusionResult>).fusionObjectKey;

  if (entry.type === 'GROUNDING' && groundingOverlayObjectKey) {
    // Draw each detection's real box on top of the overlay image — using
    // the backend's own sourcePixel box against the source raster's actual
    // pixel width/height, not an invented position.
    const groundingAsset = assetById(entry.assetAId ?? null);
    const groundingShapes: OverlayShape[] = (detections ?? []).flatMap((d, i) => {
      const box = d.sourcePixel ?? d.pixel;
      if (!box) return [];
      const frac = pixelBoxToFractionalBox(box, groundingAsset?.width, groundingAsset?.height);
      if (!frac) return [];
      return [{ id: `det-${i}`, kind: 'box' as const, color: '#f5a623', label: d.label, box: frac }];
    });
    images = (
      <div style={{ margin: '14px 0', maxWidth: 420 }}>
        <ObjectImage client={client} label="Grounding overlay" objectKey={groundingOverlayObjectKey} shapes={groundingShapes} />
        {groundingShapes.length === 0 && (detections?.length ?? 0) > 0 && (
          <div className="hint" style={{ marginTop: 8 }}>
            Detections were returned but no pixel box or source asset dimensions were available to place them — outlines are
            omitted rather than guessed.
          </div>
        )}
      </div>
    );
  } else if (entry.type === 'FUSION' && fusionObjectKey) {
    images = (
      <div style={{ margin: '14px 0', maxWidth: 420 }}>
        <ObjectImage client={client} label="Fusion output" objectKey={fusionObjectKey} />
      </div>
    );
  } else if (entry.type === 'CHAT') {
    // Chat can route to any tool — show whichever image key happens to be present.
    const chatKey =
      (r as any).changeVisualizationObjectKey ?? (r as any).groundingOverlayObjectKey ?? (r as any).fusionObjectKey;
    if (chatKey) {
      images = (
        <div style={{ margin: '14px 0', maxWidth: 420 }}>
          <ObjectImage client={client} label="Result image" objectKey={chatKey} />
        </div>
      );
    }
  }

  const answer = entry.answer || (r as any).caption || (r as any).answer;

  return (
    <div className="result-card">
      <div className="result-head">
        <span className="result-type">{entry.type}</span>
        <span className="result-time">{new Date(entry.ts).toLocaleString()}</span>
      </div>
      {(entry.assetAName || entry.assetBName) && (
        <div className="hint" style={{ marginBottom: 10 }}>
          {entry.assetAName && (
            <>
              Asset A: <b style={{ color: 'var(--text)' }}>{entry.assetAName}</b>{' '}
            </>
          )}
          {entry.assetBName && (
            <>
              · Asset B: <b style={{ color: 'var(--text)' }}>{entry.assetBName}</b>
            </>
          )}
        </div>
      )}
      {entry.question && <div className="hint" style={{ marginBottom: 8 }}>Question: "{entry.question}"</div>}
      {answer && <div className="answer-box">{answer}</div>}
      {stats}
      {images}
      {Array.isArray(detections) && detections.length > 0 && (
        <table className="det-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Area (ha)</th>
            </tr>
          </thead>
          <tbody>
            {detections.map((d, i) => {
              const loc = d.location ?? d.geometry?.centroid;
              return (
                <tr key={i}>
                  <td style={{ fontFamily: 'var(--body)', color: 'var(--text)' }}>{d.label || '—'}</td>
                  <td>{loc ? loc.latitude.toFixed(5) : '—'}</td>
                  <td>{loc ? loc.longitude.toFixed(5) : '—'}</td>
                  <td>{d.areaHectares != null ? d.areaHectares.toFixed(4) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {locs.length === 0 && <span className="loc-chip dim">No WGS84 coordinates in this response.</span>}
        {locs.map((l, i) => (
          <span key={i} className="loc-chip" onClick={() => onFocus(l.lat, l.lon)}>
            📍 {l.label}: {l.lat.toFixed(4)}, {l.lon.toFixed(4)}
          </span>
        ))}
        {locs.map((l, i) => (
          <a key={'g' + i} className="gmap-link" href={googleMapsPinUrl(l.lat, l.lon)} target="_blank" rel="noreferrer">
            🌍 {l.label} in Maps
          </a>
        ))}
      </div>
      <details className="raw">
        <summary>▾ Raw JSON response</summary>
        <JsonView data={r} />
      </details>
    </div>
  );
};

export const ResultsPage: React.FC<{ onFocusLocation: (lat: number, lon: number) => void }> = ({ onFocusLocation }) => {
  const { current, history, setCurrent } = useApp();

  return (
    <section>
      <div className="page-head">
        <div className="eyebrow">Investigation summary</div>
        <h1 className="page-title">Results</h1>
        <p className="page-desc">Full response from the last call, plus a history of every request made this session.</p>
      </div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {!current && (
            <div className="empty" style={{ textAlign: 'left', padding: '30px 4px' }}>
              No investigation run yet. Head to <b>Investigate</b> to call an endpoint.
            </div>
          )}
          {current && <ResultBody entry={current} onFocus={onFocusLocation} />}
        </div>
        <div style={{ width: 300, flex: 'none' }} className="panel">
          <div className="panel-title">
            <span className="n" />
            Session history
          </div>
          {history.length === 0 && <div className="empty">Empty.</div>}
          {history.map((e, i) => (
            <div className="history-row" key={i} onClick={() => setCurrent(e)}>
              <span className="htag">{e.type}</span>
              <span className="hq">{e.question || e.assetAName || '—'}</span>
              <span className="ht">{new Date(e.ts).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};