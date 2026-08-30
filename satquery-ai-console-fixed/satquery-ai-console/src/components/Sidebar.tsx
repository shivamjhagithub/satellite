import React, { useEffect, useRef, useState } from 'react';
import { useApp, errMsg } from '../state/AppContext';
import { Modality } from '../types/api';

/**
 * Indicative upload pipeline steps shown as a live-looking log while an
 * upload is in flight. The backend does not stream real progress events for
 * asset uploads — it's a single multipart request/response round trip —
 * so this is a simulated sequence timed to look plausible, exactly like the
 * pipeline trace used for AI/geospatial operations in RunPanel. It is always
 * labeled "Simulated pipeline trace" in the UI so it's never mistaken for a
 * genuine server log.
 */
const UPLOAD_STEPS = ['Uploading GeoTIFF…', 'Parsing raster headers…', 'Extracting CRS and bounds…', 'Reprojecting footprint to WGS84…'];

/**
 * Timed playback of a step list while a request is in flight. Mirrors the
 * useSimulatedLog hook in RunPanel.tsx: steps advance on a randomized pace,
 * and if the real response takes longer than the scripted sequence, it
 * holds on a generic "still working" line rather than stopping.
 */
function useSimulatedLog(steps: string[], running: boolean) {
  const [lines, setLines] = useState<{ text: string; done: boolean }[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!running) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    setLines([]);
    let i = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      if (i < steps.length) {
        const text = steps[i];
        i += 1;
        setLines((prev) => [...prev, { text, done: false }]);
        const delay = 550 + Math.random() * 500;
        timerRef.current = setTimeout(tick, delay);
      } else {
        setLines((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.text === 'Waiting on backend…') return prev;
          return [...prev, { text: 'Waiting on backend…', done: false }];
        });
        timerRef.current = setTimeout(tick, 1400);
      }
    };

    timerRef.current = setTimeout(tick, 260);
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return [lines, setLines] as const;
}

export const Sidebar: React.FC = () => {
  const { projects, projectId, setProjectId, createProject, refreshProjects, assets, assetA, assetB, cycleAssetRole, client, refreshAssets, toast } =
    useApp();

  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [modality, setModality] = useState<Modality>('UNKNOWN');
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [logLines, setLogLines] = useSimulatedLog(UPLOAD_STEPS, uploading);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [logLines]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createProject(name.trim(), desc.trim() || undefined);
    setName('');
    setDesc('');
    setShowNew(false);
  };

  const finishLog = (ok: boolean) => {
    setLogLines((prev) => {
      const trimmed = prev.filter((l) => l.text !== 'Waiting on backend…');
      return [...trimmed, { text: ok ? 'Done.' : 'Failed.', done: true }];
    });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!projectId) {
      toast('Select or create a project first.', 'err');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setUploading(true);
    setUploadStatus(null);
    try {
      await client.uploadAsset(projectId, file, modality);
      setUploadStatus({ ok: true, msg: 'Uploaded — metadata extracted.' });
      finishLog(true);
      toast('Uploaded — metadata extracted.', 'ok');
      await refreshAssets();
    } catch (err) {
      setUploadStatus({ ok: false, msg: errMsg(err) });
      finishLog(false);
      toast('Upload failed — ' + errMsg(err), 'err');
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <aside className="sidebar">
      <div className="panel">
        <div className="panel-title">
          <span className="n" />
          Project
        </div>
        <div className="field">
          <label>Active project</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— none —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="small-btn-row">
          <button className="btn sm" onClick={() => setShowNew((s) => !s)}>
            + New project
          </button>
          <button className="btn sm ghost" onClick={() => refreshProjects()}>
            ↻ Refresh
          </button>
        </div>
        {showNew && (
          <div style={{ marginTop: 10 }}>
            <div className="field">
              <label>Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ghaziabad Urban Watch" />
            </div>
            <div className="field">
              <label>Description (optional)</label>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What this project tracks…" />
            </div>
            <div className="small-btn-row">
              <button className="btn primary sm" onClick={handleCreate}>
                Create
              </button>
              <button className="btn sm ghost" onClick={() => setShowNew(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-title">
          <span className="n" />
          Raster assets
        </div>
        <div className="asset-list">
          {!projectId && <div className="empty">Select a project to load assets.</div>}
          {projectId && assets.length === 0 && <div className="empty">No assets yet. Upload a GeoTIFF below.</div>}
          {assets.map((a) => {
            const isA = assetA === a.id;
            const isB = assetB === a.id;
            const dims = a.width && a.height ? `${a.width}×${a.height}` : 'metadata pending';
            return (
              <div key={a.id} className="asset-row" onClick={() => cycleAssetRole(a.id)}>
                <div className={`mod mod-${a.modality}`}>{a.modality[0]}</div>
                <div className="asset-meta">
                  <div className="name">{a.originalFilename || a.objectKey}</div>
                  <div className="sub">
                    {dims}
                    {a.crs ? ` · ${a.crs}` : ''}
                  </div>
                </div>
                <div className="role-tags">
                  {isA && <span className="role-tag on-a">A</span>}
                  {isB && <span className="role-tag on-b">B</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="hint" style={{ margin: '8px 0 6px' }}>
          Click once = set as <b style={{ color: 'var(--saffron)' }}>Asset A</b>. Click again = set as{' '}
          <b style={{ color: 'var(--isro-blue-bright)' }}>Asset B</b>.
        </div>
        <label className="btn sm block" style={{ marginTop: 2, pointerEvents: uploading ? 'none' : 'auto', opacity: uploading ? 0.6 : 1 }}>
          {uploading ? <span className="spinner" /> : '⬆'} Upload GeoTIFF
          <input ref={fileRef} type="file" accept=".tif,.tiff" style={{ display: 'none' }} onChange={handleFile} disabled={uploading} />
        </label>
        <div className="field" style={{ marginTop: 8 }}>
          <label>Modality for upload</label>
          <select value={modality} onChange={(e) => setModality(e.target.value as Modality)} disabled={uploading}>
            <option value="OPTICAL">OPTICAL</option>
            <option value="SAR">SAR</option>
            <option value="UNKNOWN">UNKNOWN</option>
          </select>
        </div>
        {uploadStatus && !uploading && (
          <div className="hint" style={{ marginTop: 8, color: uploadStatus.ok ? '#8fe6b3' : '#fca5a5' }}>
            {uploadStatus.msg}
          </div>
        )}
        {logLines.length > 0 && (
          <div className="log-panel">
            <div className="log-panel-head">
              <span className={`log-dot ${uploading ? 'live' : uploadStatus?.ok ? 'ok' : 'err'}`} />
              Simulated pipeline trace
              <span className="log-panel-note">— indicative steps, not raw backend output</span>
            </div>
            <div className="log-box" ref={logBoxRef}>
              {logLines.map((l, i) => (
                <div key={i} className={`log-line ${l.done ? (uploadStatus?.ok === false ? 'log-err' : 'log-ok') : ''}`}>
                  <span className="log-prefix">{l.done ? (uploadStatus?.ok === false ? '✕' : '✓') : '›'}</span>
                  {l.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
