import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import Globe, { GlobeMethods } from 'react-globe.gl';
import { useApp } from '../state/AppContext';
import { PlottedLocation, colorForSource } from '../utils/location';
import { googleMapsPinUrl, googleMapsSatelliteUrl, googleMapsEmbedUrl, hasEmbedKey } from '../utils/googleMaps';

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/**
 * Adds a semi-transparent, independently-rotating cloud shell above the
 * globe surface, plus a tuned sun/ambient light pair instead of
 * react-globe.gl's flat default lighting. Both are done by reaching into
 * the underlying three.js scene — react-globe.gl exposes `.scene()` and
 * `.lights()` for exactly this. Runs once the globe instance is mounted
 * and cleans itself up on unmount.
 */
function useRealisticGlobeDressing(globeRef: React.MutableRefObject<GlobeMethods | undefined>, ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const globe = globeRef.current as any;
    if (!globe) return;

    let cloudsMesh: THREE.Mesh | null = null;
    let frameId = 0;
    let cancelled = false;

    // Sun-like directional light + soft ambient fill, replacing the flat
    // default lighting so the day/night terminator and topology actually read.
    const sun = new THREE.DirectionalLight(0xffffff, 1.15);
    sun.position.set(-1, 0.35, 1);
    const ambient = new THREE.AmbientLight(0xbfd4ff, 0.5);
    globe.lights([ambient, sun]);

    const CLOUDS_URL = 'https://raw.githubusercontent.com/turban/webgl-earth/master/images/fair_clouds_4k.png';
    const CLOUDS_ALTITUDE = 0.008; // fraction of globe radius above the surface
    const CLOUDS_DEG_PER_FRAME = -0.006; // independent drift, opposite the globe's own rotation

    new THREE.TextureLoader().load(CLOUDS_URL, (texture) => {
      if (cancelled) return;
      const globeRadius = typeof globe.getGlobeRadius === 'function' ? globe.getGlobeRadius() : 100;
      const geometry = new THREE.SphereGeometry(globeRadius * (1 + CLOUDS_ALTITUDE), 75, 75);
      const material = new THREE.MeshLambertMaterial({ map: texture, transparent: true, opacity: 0.45 });
      cloudsMesh = new THREE.Mesh(geometry, material);
      globe.scene().add(cloudsMesh);

      const spin = () => {
        if (cloudsMesh) cloudsMesh.rotation.y += (CLOUDS_DEG_PER_FRAME * Math.PI) / 180;
        frameId = requestAnimationFrame(spin);
      };
      spin();
    });

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (cloudsMesh) globe.scene().remove(cloudsMesh);
    };
  }, [globeRef, ready]);
}

export const ExplorerPage: React.FC = () => {
  const { markers, clearMarkers, plotLocations, focusTarget, focusLocation } = useApp();
  const [stageRef, size] = useElementSize<HTMLDivElement>();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [globeReady, setGlobeReady] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [selected, setSelected] = useState<PlottedLocation | null>(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');

  // Realistic day-lit Earth: NASA Blue Marble texture + bump map + a real starfield backdrop,
  // served from three-globe's public example assets (loaded at runtime in the user's browser).
  const globeImageUrl = '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
  const bumpImageUrl = '//unpkg.com/three-globe/example/img/earth-topology.png';
  const backgroundImageUrl = '//unpkg.com/three-globe/example/img/night-sky.png';

  useRealisticGlobeDressing(globeRef, globeReady);

  useEffect(() => {
    const controls = globeRef.current?.controls?.();
    if (controls) {
      (controls as any).autoRotate = autoRotate;
      (controls as any).autoRotateSpeed = 0.35;

    }
  }, [autoRotate, size]);

  useEffect(() => {
    if (focusTarget && globeRef.current) {
      globeRef.current.pointOfView({ lat: focusTarget.lat, lng: focusTarget.lon, altitude: 1.6 }, 900);
      setSelected(focusTarget);
      setAutoRotate(false);
    }
  }, [focusTarget]);

  const pointsData = useMemo(
    () =>
      markers.map((m) => ({
        lat: m.lat,
        lng: m.lon,
        label: m.label,
        color: colorForSource(m.source),
        loc: m,
      })),
    [markers]
  );

  const embedUrl = selected ? googleMapsEmbedUrl(selected.lat, selected.lon) : null;

  return (
    <section>
      <div className="page-head">
        <div className="eyebrow">3D Earth · WGS84</div>
        <h1 className="page-title">Data Explorer</h1>
        <p className="page-desc">
          Locations plotted here come only from coordinates your backend actually returned — GeoTIFF affine transforms reprojected to
          EPSG:4326, never invented by a model. Click any pin to jump to its present-day view in Google Maps.
        </p>
      </div>

      <div className="explorer-wrap">
        <div className="globe-stage" ref={stageRef}>
          {selected && (
            <div className="crosshair-label">
              <div className="cl-title">Active location</div>
              <div>
                {selected.lat.toFixed(4)}° N, {selected.lon.toFixed(4)}° E
              </div>
              <div style={{ color: 'var(--text-faint)', marginTop: 3 }}>{selected.label}</div>
              <div className="cl-actions">
                <a className="gmap-link" href={googleMapsPinUrl(selected.lat, selected.lon)} target="_blank" rel="noreferrer">
                  🌍 Open in Google Maps
                </a>
                <a className="gmap-link" href={googleMapsSatelliteUrl(selected.lat, selected.lon)} target="_blank" rel="noreferrer">
                  🛰️ Satellite view
                </a>
              </div>
              {embedUrl && <iframe className="embed-frame" src={embedUrl} loading="lazy" title="Google Maps preview" />}
            </div>
          )}
          <div className="globe-toolbar">
            <button className="icon-btn" title="Toggle auto-rotate" onClick={() => setAutoRotate((v) => !v)}>
              ⟳
            </button>
            <button
              className="icon-btn"
              title="Reset view"
              onClick={() => {
                globeRef.current?.pointOfView({ lat: 20, lng: 78, altitude: 2.4 }, 800);
                setSelected(null);
                setAutoRotate(true);
              }}
            >
              ⤢
            </button>
          </div>
          <Globe
            ref={(instance: GlobeMethods | undefined) => {
              (globeRef as React.MutableRefObject<GlobeMethods | undefined>).current = instance;
              if (instance && !globeReady) setGlobeReady(true);
            }}
            width={size.width}
            height={size.height}
            globeImageUrl={globeImageUrl}
            bumpImageUrl={bumpImageUrl}
            backgroundImageUrl={backgroundImageUrl}
            atmosphereColor="#7db0ff"
            atmosphereAltitude={0.18}
            pointsData={pointsData}
            pointLat="lat"
            pointLng="lng"
            pointColor="color"
            pointAltitude={0.012}
            pointRadius={0.45}
            pointLabel={(d: any) => `${d.label}<br/>${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}`}
            onPointClick={(d: any) => {
              setSelected(d.loc);
              setAutoRotate(false);
              globeRef.current?.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.4 }, 700);
            }}
          />
          <div className="globe-hint">Drag to rotate · Scroll to zoom · Click a pin for details</div>
        </div>

        <div className="explorer-side">
          <div className="panel">
            <div className="panel-title">
              <span className="n" />
              Plotted locations
            </div>
            {markers.length === 0 && (
              <div className="empty">Run Caption, VQA, Ground, Change, Fusion, or a Compatibility check to plot real coordinates here.</div>
            )}
            {markers.map((m, i) => (
              <div
                className="marker-row"
                key={i}
                onClick={() => {
                  setSelected(m);
                  focusLocation(m);
                }}
              >
                <span className="marker-dot" style={{ background: colorForSource(m.source) }} />
                <div className="marker-info">
                  <div className="m-label">{m.label}</div>
                  <div className="m-coord">
                    {m.lat.toFixed(5)}, {m.lon.toFixed(5)}
                  </div>
                  <div className="m-links">
                    <a
                      className="gmap-link"
                      href={googleMapsPinUrl(m.lat, m.lon)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Maps ↗
                    </a>
                  </div>
                </div>
              </div>
            ))}
            {markers.length > 0 && (
              <button className="btn sm ghost block" style={{ marginTop: 8 }} onClick={clearMarkers}>
                Clear all pins
              </button>
            )}
            {!hasEmbedKey() && (
              <div className="hint" style={{ marginTop: 10 }}>
                Set <code>VITE_GOOGLE_MAPS_EMBED_KEY</code> to also show an inline satellite preview panel. The "Open in Google Maps"
                link works without any key.
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-title">
              <span className="n" />
              Manual lookup
            </div>
            <div className="field">
              <label>Latitude</label>
              <input type="text" value={manualLat} onChange={(e) => setManualLat(e.target.value)} placeholder="e.g. 28.6830" />
            </div>
            <div className="field">
              <label>Longitude</label>
              <input type="text" value={manualLon} onChange={(e) => setManualLon(e.target.value)} placeholder="e.g. 77.3229" />
            </div>
            <button
              className="btn sm block"
              onClick={() => {
                const lat = parseFloat(manualLat);
                const lon = parseFloat(manualLon);
                if (Number.isNaN(lat) || Number.isNaN(lon)) return;
                plotLocations([{ lat, lon, label: 'Manual point', source: 'MANUAL' }]);
              }}
            >
              Plot point
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
