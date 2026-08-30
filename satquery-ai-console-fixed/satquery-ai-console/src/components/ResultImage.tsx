import React, { useState } from 'react';
import { OverlayShape } from '../utils/overlay';
/**
 * Labelled image tile for a stored object (preview, change map, change
 * visualization, grounding overlay, fusion output, ...). Renders the exact
 * artifact the backend produced. Shows a spinner while loading and a clear
 * fallback if the object is missing (404) or the request otherwise fails.
 *
 * Optionally draws `shapes` — detection boxes / change polygons computed
 * from the JSON response itself (see src/utils/overlay.ts) — as an SVG
 * layer on top of the image. Shapes are given in 0..1 fractions of the
 * image's own dimensions, so the overlay tracks the image exactly no
 * matter how large it's displayed.
 */
export const ResultImage: React.FC<{
  label: string;
  src: string | null | undefined;
  caption?: string;
  shapes?: OverlayShape[];
}> = ({ label, src, caption, shapes }) => {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');

  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: '1.3px',
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          position: 'relative',
          background: 'var(--bg)',
          border: '1px solid var(--border-soft)',
          borderRadius: 'var(--r)',
          overflow: 'hidden',
          minHeight: 140,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!src && (
          <span className="hint" style={{ padding: 16 }}>
            Not available for this result.
          </span>
        )}
        {src && state === 'error' && (
          <span className="hint" style={{ padding: 16, color: 'var(--red)' }}>
            Could not load this image — it may not have been generated or is no longer stored.
          </span>
        )}
        {src && (
          <img
            src={src}
            alt={label}
            onLoad={() => setState('ok')}
            onError={() => setState('error')}
            style={{
              display: state === 'error' ? 'none' : 'block',
              width: '100%',
              height: 'auto',
              opacity: state === 'ok' ? 1 : 0.35,
              transition: 'opacity 120ms ease',
            }}
          />
        )}
        {src && state === 'ok' && shapes && shapes.length > 0 && (
          <svg
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            {shapes.map((s) => {
              if (s.kind === 'box' && s.box) {
                return (
                  <rect
                    key={s.id}
                    x={s.box.x}
                    y={s.box.y}
                    width={s.box.w}
                    height={s.box.h}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={0.0045}
                  >
                    {s.label && <title>{s.label}</title>}
                  </rect>
                );
              }
              if (s.kind === 'polygon' && s.rings) {
                return s.rings.map((ring, i) =>
                  ring.length >= 3 ? (
                    <polygon
                      key={`${s.id}-${i}`}
                      points={ring.map(([x, y]) => `${x},${y}`).join(' ')}
                      fill={`${s.color}33`}
                      stroke={s.color}
                      strokeWidth={0.0035}
                    >
                      {s.label && <title>{s.label}</title>}
                    </polygon>
                  ) : null
                );
              }
              return null;
            })}
          </svg>
        )}
      </div>
      {caption && (
        <div className="hint" style={{ marginTop: 4 }}>
          {caption}
        </div>
      )}
    </div>
  );
};